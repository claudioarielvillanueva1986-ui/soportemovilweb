// Cliente de servidor de la Partner API de Facturá (solo se importa desde
// app/api/**). Soporte Móvil delega toda la facturación electrónica (ARCA) y
// los cobros de Mercado Pago en Facturá: acá vive el OAuth de partner, el
// refresh de tokens y el "entitlement" (habilitar la cuenta de Facturá
// mientras el combo esté pago). Nada sensible queda en el cliente.
import { rpcConSecreto } from '@/lib/mp-server';

export function facturaConfigurado() {
  return Boolean(
    process.env.FACTURA_CLIENT_ID && process.env.FACTURA_CLIENT_SECRET
  );
}

export function facturaUrl() {
  return (process.env.FACTURA_URL || 'https://factura-ar.netlify.app').replace(/\/$/, '');
}

// URL pública FIJA de Soporte Móvil (producción). Se usa para armar el
// redirect_uri del OAuth: debe coincidir EXACTO con el whitelisteado en Facturá,
// nunca el origin dinámico del deploy (previews/branches lo rompen).
export function appPublicUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://soportemovil.netlify.app').replace(/\/$/, '');
}

export const SCOPES_FACTURA = 'lectura facturacion cobros';

async function pedirTokenFactura(payload) {
  const res = await fetch(`${facturaUrl()}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.FACTURA_CLIENT_ID,
      client_secret: process.env.FACTURA_CLIENT_SECRET,
      ...payload,
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Facturá OAuth ${res.status}`);
  return data; // { access_token, refresh_token, expires_in, scope, negocio_id }
}

export function canjearCodigoFactura(code, redirectUri) {
  return pedirTokenFactura({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
}

export function refrescarTokenFactura(refreshToken) {
  return pedirTokenFactura({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function guardarConexionFactura(negocioId, tokens) {
  await rpcConSecreto('factura_guardar_conexion', {
    p_negocio_id: negocioId,
    p_factura_negocio_id: tokens.negocio_id || null,
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token || null,
    p_expira_en: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    p_scopes: String(tokens.scope || '').split(' ').filter(Boolean),
  });
}

// Devuelve la conexión (con tokens) para uso del servidor, refrescando el
// access_token si está por vencer.
export async function contextoFactura(negocioId) {
  const ctx = await rpcConSecreto('factura_contexto', { p_negocio_id: negocioId });
  if (!ctx?.access_token) return null;

  const porVencer = ctx.expira_en && new Date(ctx.expira_en) - Date.now() < 5 * 60000;
  if (porVencer && ctx.refresh_token) {
    try {
      const t = await refrescarTokenFactura(ctx.refresh_token);
      // el refresh de Facturá conserva el negocio; reusamos el guardado
      await guardarConexionFactura(negocioId, { ...t, negocio_id: ctx.factura_negocio_id });
      return {
        ...ctx,
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expira_en: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
      };
    } catch {
      // si el refresh falla, se intenta con el token actual
    }
  }
  return ctx;
}

// Llamada autenticada a la Partner API de Facturá con el token del negocio.
export async function facturaFetch(negocioId, path, { method = 'GET', body } = {}) {
  const ctx = await contextoFactura(negocioId);
  if (!ctx?.access_token) throw new Error('El negocio no conectó su cuenta de Facturá.');
  const res = await fetch(`${facturaUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.access_token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Facturá ${res.status}`);
  return data;
}

// Habilita la cuenta de Facturá del negocio mientras el combo esté pago.
// Best-effort: nunca lanza (se reintenta en cada pago / reconexión).
export async function sincronizarEntitlement(negocioId) {
  if (!facturaConfigurado()) return;
  try {
    const ctx = await rpcConSecreto('factura_entitlement_ctx', { p_negocio_id: negocioId });
    if (!ctx?.incluye_factura || !ctx?.conectado || !ctx?.hasta || !ctx?.factura_negocio_id) {
      return;
    }
    await fetch(`${facturaUrl()}/api/partners/entitlement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.FACTURA_CLIENT_ID,
        client_secret: process.env.FACTURA_CLIENT_SECRET,
        negocio_id: ctx.factura_negocio_id,
        hasta: ctx.hasta,
      }),
      cache: 'no-store',
    });
  } catch {
    // reconciliación en el próximo pago o reconexión
  }
}
