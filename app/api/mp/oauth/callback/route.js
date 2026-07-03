import {
  oauthConfigurado,
  verificarEstado,
  rpcConSecreto,
  mpFetchConToken,
} from '@/lib/mp-server';

// Vuelta del login de Mercado Pago: canjea el code por los tokens del taller,
// intenta crear una caja para el QR dinámico y guarda todo. Luego vuelve al wizard.
export async function GET(request) {
  const url = new URL(request.url);
  const volver = (extra) => Response.redirect(`${url.origin}/panel/config${extra}`, 302);

  if (!oauthConfigurado()) return volver('?mp=error&detalle=sin-credenciales');

  const code = url.searchParams.get('code');
  const negocioId = verificarEstado(url.searchParams.get('state'));
  if (!code || !negocioId) return volver('?mp=error&detalle=estado-invalido');

  try {
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${url.origin}/api/mp/oauth/callback`,
      }),
      cache: 'no-store',
    });
    const tok = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(tok?.message || 'No se pudo canjear el código');

    // Mejor esfuerzo: crear la caja (POS) para el QR dinámico
    let posExternalId = null;
    try {
      const externalId = `SMV${String(negocioId).replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      await mpFetchConToken(tok.access_token, '/pos', {
        method: 'POST',
        body: {
          name: 'Caja principal',
          external_id: externalId,
          fixed_amount: false,
        },
      });
      posExternalId = externalId;
    } catch {
      // si el vendedor ya tiene cajas o falla, el QR mostrará el aviso correspondiente
    }

    await rpcConSecreto('mp_guardar_conexion', {
      p_negocio_id: negocioId,
      p_mp_user_id: String(tok.user_id),
      p_access_token: tok.access_token,
      p_refresh_token: tok.refresh_token || null,
      p_public_key: tok.public_key || null,
      p_live_mode: tok.live_mode !== false,
      p_expires_at: new Date(Date.now() + (tok.expires_in || 15552000) * 1000).toISOString(),
      p_pos_external_id: posExternalId,
    });

    return volver('?mp=ok');
  } catch (e) {
    return volver(`?mp=error&detalle=${encodeURIComponent(e.message).slice(0, 120)}`);
  }
}
