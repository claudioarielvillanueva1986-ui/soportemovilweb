import { mpConfigurado, mpFetch, rpcConSecreto } from '@/lib/mp-server';

// Webhook de Mercado Pago.
// Regla heredada de v1: el webhook NUNCA inserta ventas — solo registra el pago
// y marca el cobro; el POS (con sesión de staff) es el único que crea la venta.
// Antiduplicación garantizada por UNIQUE en pagos_mp.mp_payment_id.
export async function POST(request) {
  if (!mpConfigurado()) return Response.json({ ok: true });

  let paymentId = null;
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const topic = url.searchParams.get('topic') || url.searchParams.get('type') || body?.type;
    paymentId =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id') ||
      body?.data?.id ||
      null;

    if (!paymentId || (topic && !String(topic).includes('payment'))) {
      return Response.json({ ok: true });
    }

    const pago = await mpFetch(`/v1/payments/${paymentId}`);

    await rpcConSecreto('mp_confirmar_pago', {
      p_cobro_id: pago.external_reference || null,
      p_payment_id: String(pago.id),
      p_estado: pago.status,
      p_monto: pago.transaction_amount,
      p_raw: {
        status: pago.status,
        status_detail: pago.status_detail,
        payment_method_id: pago.payment_method_id,
        date_approved: pago.date_approved,
      },
    });
  } catch (e) {
    // Siempre 200: si devolvemos error, MP reintenta en loop.
    console.error('webhook mp:', e.message, paymentId);
  }
  return Response.json({ ok: true });
}
