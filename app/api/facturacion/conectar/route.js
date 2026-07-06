import { createClient } from '@supabase/supabase-js';
import { firmarEstado } from '@/lib/mp-server';
import { facturaConfigurado, facturaUrl, baseRedirect, SCOPES_FACTURA } from '@/lib/factura-server';
import { errorJson } from '@/lib/mp-server';

// Inicia la conexión con Facturá (OAuth de partner).
// GET /api/facturacion/conectar?negocio=<uuid>&token=<access_token>&email=<email>
// El token prueba que quien conecta es el DUEÑO del negocio.
export async function GET(request) {
  if (!facturaConfigurado()) {
    return errorJson(
      'La integración con Facturá no está habilitada aún (faltan FACTURA_CLIENT_ID y FACTURA_CLIENT_SECRET).',
      501
    );
  }

  const url = new URL(request.url);
  const negocio = url.searchParams.get('negocio');
  const token = url.searchParams.get('token');
  const email = url.searchParams.get('email') || '';
  if (!negocio || !token) return errorJson('Falta el negocio o la sesión', 400);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: autorizado, error } = await supa.rpc('mp_puede_conectar', {
    p_negocio_id: negocio,
  });
  if (error || !autorizado) {
    return errorJson('No tenés permiso para conectar Facturá a este negocio.', 403);
  }

  // redirect_uri = dominio real de producción desde el que entra el usuario
  // (para volver al mismo dominio y no perder la sesión); previews → canónico.
  const redirectUri = `${baseRedirect(url.origin)}/api/facturacion/callback`;
  const auth = new URL(`${facturaUrl()}/oauth/autorizar`);
  auth.searchParams.set('client_id', process.env.FACTURA_CLIENT_ID);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('scope', SCOPES_FACTURA);
  auth.searchParams.set('state', firmarEstado(negocio));
  if (email) auth.searchParams.set('login_hint', email);

  return Response.redirect(auth.toString(), 302);
}
