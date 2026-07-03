import {
  rpcConSecreto,
  mpFetchConToken,
  tokenVigente,
  errorJson,
  NO_CONECTADO_MSG,
} from '@/lib/mp-server';

// Genera un QR dinámico usando la cuenta de Mercado Pago DEL NEGOCIO (OAuth).
export async function POST(request) {
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
    const ctx = await rpcConSecreto('mp_contexto_cobro', { p_cobro_id: cobro_id });
    if (!ctx) return errorJson('Cobro inexistente', 404);
    if (!ctx.conectado) return errorJson(NO_CONECTADO_MSG, 501);
    if (!ctx.pos_external_id) {
      return errorJson(
        'Tu cuenta de Mercado Pago no tiene una caja para QR. Desconectá y volvé a conectar desde Configuración.',
        501
      );
    }

    const token = await tokenVigente(ctx);
    const origin = new URL(request.url).origin;
    const orden = await mpFetchConToken(
      token,
      `/instore/orders/qr/seller/collectors/${ctx.mp_user_id}/pos/${ctx.pos_external_id}/qrs`,
      {
        method: 'POST',
        body: {
          external_reference: cobro_id,
          title: descripcion || 'Venta en mostrador',
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
