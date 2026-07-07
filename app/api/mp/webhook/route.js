import {
  mpConfigurado,
  mpFetch,
  mpFetchConToken,
  tokenVigente,
  rpcConSecreto,
} from '@/lib/mp-server';

// Webhook de Mercado Pago (pagos de los talleres vía OAuth).
// Regla: el webhook NUNCA inserta ventas — solo registra pagos y estados;
// la venta la crea siempre el POS con sesión de staff.
// Antiduplicación por UNIQUE en pagos_mp.mp_payment_id.
export async function POST(request) {
  let dataId = null;
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const topic =
      url.searchParams.get('topic') || url.searchParams.get('type') || body?.type;
    dataId =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id') ||
      body?.data?.id ||
      null;
    if (!dataId) return Response.json({ ok: true });

    if (topic && !String(topic).includes('payment')) {
      return Response.json({ ok: true });
    }

    // Pagos de un taller: la notificación trae el user_id del vendedor;
    // buscamos su token OAuth (renovándolo si venció) para consultar el pago.
    const sellerId = body?.user_id ? String(body.user_id) : null;
    let pago = null;
    let sellerCollector = null;
    if (sellerId) {
      const cuenta = await rpcConSecreto('mp_cuenta_por_user', {
        p_mp_user_id: sellerId,
      });
      if (cuenta?.access_token) {
        sellerCollector = sellerId;
        const token = await tokenVigente({ ...cuenta, negocio_id: cuenta.negocio_id });
        pago = await mpFetchConToken(token, `/v1/payments/${dataId}`);
      }
    }
    if (!pago && mpConfigurado()) {
      pago = await mpFetch(`/v1/payments/${dataId}`);
      sellerCollector = pago?.collector_id ? String(pago.collector_id) : sellerCollector;
    }
    if (!pago) {
      // No pudimos resolver el pago (token, red): que MP reintente, no lo perdemos.
      return Response.json({ ok: false }, { status: 503 });
    }

    // La confirmación valida en la base que el collector sea el dueño del cobro
    // y que el monto cubra el del cobro (defensa cross-tenant).
    await rpcConSecreto('mp_confirmar_pago', {
      p_cobro_id: pago.external_reference || null,
      p_payment_id: String(pago.id),
      p_estado: pago.status,
      p_monto: pago.transaction_amount,
      p_mp_user_id: sellerCollector || (pago.collector_id ? String(pago.collector_id) : null),
      p_raw: {
        status: pago.status,
        status_detail: pago.status_detail,
        payment_method_id: pago.payment_method_id,
        date_approved: pago.date_approved,
      },
    });
  } catch (e) {
    // Error transitorio (Supabase/red): 503 para que MP reintente y no perder el pago.
    console.error('webhook mp:', e.message, dataId);
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true });
}
