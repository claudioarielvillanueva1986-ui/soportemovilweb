import {
  mpConfigurado,
  mpFetch,
  rpcConSecreto,
  errorJson,
  NO_CONFIG_MSG,
} from '@/lib/mp-server';

// Genera un QR dinámico de Mercado Pago para un cobro pendiente.
// Requiere en Vercel: MP_ACCESS_TOKEN, MP_USER_ID, MP_POS_EXTERNAL_ID, MP_WEBHOOK_SECRET
export async function POST(request) {
  if (!mpConfigurado()) return errorJson(NO_CONFIG_MSG, 501);
  if (!process.env.MP_USER_ID || !process.env.MP_POS_EXTERNAL_ID) {
    return errorJson(
      'Faltan MP_USER_ID y/o MP_POS_EXTERNAL_ID (caja registrada en Mercado Pago).',
      501
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { cobro_id, monto, descripcion } = body || {};
  if (!cobro_id || !monto || Number(monto) <= 0) {
    return errorJson('Faltan cobro_id o monto');
  }

  try {
    const origin = new URL(request.url).origin;
    const orden = await mpFetch(
      `/instore/orders/qr/seller/collectors/${process.env.MP_USER_ID}/pos/${process.env.MP_POS_EXTERNAL_ID}/qrs`,
      {
        method: 'POST',
        body: {
          external_reference: cobro_id,
          title: descripcion || 'Venta Soporte Móvil',
          description: descripcion || 'Venta en mostrador',
          total_amount: Number(monto),
          items: [
            {
              title: descripcion || 'Venta en mostrador',
              unit_price: Number(monto),
              quantity: 1,
              unit_measure: 'unit',
              total_amount: Number(monto),
            },
          ],
          notification_url: `${origin}/api/mp/webhook`,
        },
      }
    );

    await rpcConSecreto('mp_guardar_qr', {
      p_cobro_id: cobro_id,
      p_qr_data: orden.qr_data,
      p_order_id: orden.in_store_order_id || null,
    });

    return Response.json({ qr_data: orden.qr_data });
  } catch (e) {
    return errorJson(`Mercado Pago: ${e.message}`, 502);
  }
}
