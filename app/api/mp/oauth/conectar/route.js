import { createClient } from '@supabase/supabase-js';
import { oauthConfigurado, firmarEstado, errorJson } from '@/lib/mp-server';

// Inicia el wizard: redirige al login de Mercado Pago del taller.
// GET /api/mp/oauth/conectar?negocio=<uuid>&token=<access_token del dueño>
// El token prueba que quien inicia la conexión es el DUEÑO de ese negocio
// (evita que un tercero secuestre la cuenta MP de otro taller).
export async function GET(request) {
  if (!oauthConfigurado()) {
    return errorJson(
      'La conexión con Mercado Pago no está habilitada aún (faltan MP_CLIENT_ID y MP_CLIENT_SECRET del dueño del producto).',
      501
    );
  }
  const url = new URL(request.url);
  const negocio = url.searchParams.get('negocio');
  const token = url.searchParams.get('token');
  if (!negocio || !token) return errorJson('Falta el negocio o la sesión', 400);

  // Verificamos con el token del usuario que sea dueño de ese negocio
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: autorizado, error } = await supa.rpc('mp_puede_conectar', {
    p_negocio_id: negocio,
  });
  if (error || !autorizado) {
    return errorJson('No tenés permiso para conectar Mercado Pago a este negocio.', 403);
  }

  const redirectUri = `${url.origin}/api/mp/oauth/callback`;
  const auth = new URL('https://auth.mercadopago.com.ar/authorization');
  auth.searchParams.set('client_id', process.env.MP_CLIENT_ID);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('platform_id', 'mp');
  auth.searchParams.set('state', firmarEstado(negocio));
  auth.searchParams.set('redirect_uri', redirectUri);

  return Response.redirect(auth.toString(), 302);
}
