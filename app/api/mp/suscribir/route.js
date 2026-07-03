import { mpConfigurado, mpFetch, errorJson, NO_CONFIG_MSG } from '@/lib/mp-server';

const PRECIO_MENSUAL = Number(process.env.SUSCRIPCION_PRECIO || 20000);

// Crea la suscripción mensual (preapproval) del negocio y devuelve el link de pago.
// El cobro lo recibe la cuenta de MP dueña del producto (MP_ACCESS_TOKEN).
export async function POST(request) {
  if (!mpConfigurado()) return errorJson(NO_CONFIG_MSG, 501);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { negocio_id, email } = body || {};
  if (!negocio_id || !email) return errorJson('Faltan negocio_id o email');

  try {
    const origin = new URL(request.url).origin;
    const pre = await mpFetch('/preapproval', {
      method: 'POST',
      body: {
        reason: 'Suscripción Soporte Móvil — Plan Pro',
        external_reference: String(negocio_id),
        payer_email: String(email),
        back_url: `${origin}/panel/plan`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: PRECIO_MENSUAL,
          currency_id: 'ARS',
        },
      },
    });
    return Response.json({ init_point: pre.init_point, precio: PRECIO_MENSUAL });
  } catch (e) {
    return errorJson(`Mercado Pago: ${e.message}`, 502);
  }
}
