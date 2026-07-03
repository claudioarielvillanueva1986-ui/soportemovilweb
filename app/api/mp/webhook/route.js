import {
  mpConfigurado,
  mpFetch,
  mpFetchConToken,
  rpcConSecreto,
} from '@/lib/mp-server';

// Webhook de Mercado Pago (pagos de los talleres vía OAuth + suscripciones del SaaS).
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

    // Suscripciones del SaaS (cobradas por la cuenta del dueño del producto)
    if (topic && String(topic).includes('preapproval')) {
      if (!mpConfigurado()) return Response.json({ ok: true });
      const pre = await mpFetch(`/preapproval/${dataId}`);
      if (pre.external_reference) {
        await rpcConSecreto('saas_actualizar_suscripcion', {
          p_negocio_id: pre.external_reference,
          p_preapproval_id: String(pre.id),
          p_estado: pre.status,
          p_monto: pre.auto_recurring?.transaction_amount ?? null,
          p_raw: { status: pre.status, next_payment_date: pre.next_payment_date },
        });
      }
      return Response.json({ ok: true });
    }

    if (topic && !String(topic).includes('payment')) {
      return Response.json({ ok: true });
    }

    // Pagos de un taller: la notificación trae el user_id del vendedor;
    // buscamos su token OAuth para consultar el pago.
    const sellerId = body?.user_id ? String(body.user_id) : null;
    let pago = null;
    if (sellerId) {
      const cuenta = await rpcConSecreto('mp_cuenta_por_user', {
        p_mp_user_id: sellerId,
      });
      if (cuenta?.access_token) {
        pago = await mpFetchConToken(cuenta.access_token, `/v1/payments/${dataId}`);
      }
    }
    if (!pago && mpConfigurado()) {
      pago = await mpFetch(`/v1/payments/${dataId}`);
    }
    if (!pago) return Response.json({ ok: true });

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
    console.error('webhook mp:', e.message, dataId);
  }
  return Response.json({ ok: true });
}
