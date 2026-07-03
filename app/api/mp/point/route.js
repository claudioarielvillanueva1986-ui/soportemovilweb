import {
  rpcConSecreto,
  mpFetchConToken,
  tokenVigente,
  errorJson,
  NO_CONECTADO_MSG,
} from '@/lib/mp-server';

// Intención de pago en la terminal Point DEL NEGOCIO (OAuth).
export async function POST(request) {
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
    const ctx = await rpcConSecreto('mp_contexto_cobro', { p_cobro_id: cobro_id });
    if (!ctx) return errorJson('Cobro inexistente', 404);
    if (!ctx.conectado) return errorJson(NO_CONECTADO_MSG, 501);
    if (!ctx.point_device_id) {
      return errorJson(
        'Este negocio no tiene una terminal Point configurada. El dueño puede elegirla en Configuración.',
        501
      );
    }

    const token = await tokenVigente(ctx);
    const intent = await mpFetchConToken(
      token,
      `/point/integration-api/devices/${ctx.point_device_id}/payment-intents`,
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
