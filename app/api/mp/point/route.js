import {
  mpConfigurado,
  mpFetch,
  rpcConSecreto,
  errorJson,
  NO_CONFIG_MSG,
} from '@/lib/mp-server';

// Crea una intención de pago en la terminal Point (ej. Newland N950).
// Requiere en Vercel: MP_ACCESS_TOKEN, MP_POINT_DEVICE_ID, MP_WEBHOOK_SECRET
export async function POST(request) {
  if (!mpConfigurado()) return errorJson(NO_CONFIG_MSG, 501);
  if (!process.env.MP_POINT_DEVICE_ID) {
    return errorJson(
      'Falta MP_POINT_DEVICE_ID (ID del dispositivo Point vinculado a tu cuenta).',
      501
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { cobro_id, monto } = body || {};
  if (!cobro_id || !monto || Number(monto) <= 0) {
    return errorJson('Faltan cobro_id o monto');
  }

  try {
    // La API de Point espera el monto en centavos (entero)
    const intent = await mpFetch(
      `/point/integration-api/devices/${process.env.MP_POINT_DEVICE_ID}/payment-intents`,
      {
        method: 'POST',
        body: {
          amount: Math.round(Number(monto) * 100),
          additional_info: {
            external_reference: cobro_id,
            print_on_terminal: true,
          },
        },
      }
    );

    await rpcConSecreto('mp_guardar_qr', {
      p_cobro_id: cobro_id,
      p_qr_data: null,
      p_order_id: intent.id || null,
    });

    return Response.json({ intent_id: intent.id });
  } catch (e) {
    return errorJson(`Mercado Pago Point: ${e.message}`, 502);
  }
}
