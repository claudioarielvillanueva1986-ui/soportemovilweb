import { createClient } from '@supabase/supabase-js';
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

  // Solo el dueño del negocio puede iniciar su suscripción
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: autorizado } = await supa.rpc('mp_puede_conectar', { p_negocio_id: negocio_id });
  if (!autorizado) return errorJson('No autorizado para este negocio.', 403);

  // Precio del combo calculado en la base (base + Facturá + sucursales)
  let precio = PRECIO_MENSUAL;
  let incluyeFactura = false;
  const { data: plan } = await supa.rpc('precio_plan');
  if (plan?.total) {
    precio = Number(plan.total);
    incluyeFactura = !!plan.incluye_factura;
  }

  const reason = incluyeFactura
    ? 'Suscripción Soporte Móvil — Gestión + Facturá'
    : 'Suscripción Soporte Móvil — Gestión de taller';

  try {
    const origin = new URL(request.url).origin;
    const pre = await mpFetch('/preapproval', {
      method: 'POST',
      body: {
        reason,
        external_reference: String(negocio_id),
        payer_email: String(email),
        back_url: `${origin}/panel/plan`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: precio,
          currency_id: 'ARS',
        },
      },
    });
    return Response.json({ init_point: pre.init_point, precio });
  } catch (e) {
    return errorJson(`Mercado Pago: ${e.message}`, 502);
  }
}
