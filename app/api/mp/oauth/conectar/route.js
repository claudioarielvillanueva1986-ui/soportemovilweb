import { oauthConfigurado, firmarEstado, errorJson } from '@/lib/mp-server';

// Inicia el wizard: redirige al login de Mercado Pago del taller.
// GET /api/mp/oauth/conectar?negocio=<uuid>
export async function GET(request) {
  if (!oauthConfigurado()) {
    return errorJson(
      'La conexión con Mercado Pago no está habilitada aún (faltan MP_CLIENT_ID y MP_CLIENT_SECRET del dueño del producto).',
      501
    );
  }
  const url = new URL(request.url);
  const negocio = url.searchParams.get('negocio');
  if (!negocio) return errorJson('Falta el negocio');

  const redirectUri = `${url.origin}/api/mp/oauth/callback`;
  const auth = new URL('https://auth.mercadopago.com.ar/authorization');
  auth.searchParams.set('client_id', process.env.MP_CLIENT_ID);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('platform_id', 'mp');
  auth.searchParams.set('state', firmarEstado(negocio));
  auth.searchParams.set('redirect_uri', redirectUri);

  return Response.redirect(auth.toString(), 302);
}
