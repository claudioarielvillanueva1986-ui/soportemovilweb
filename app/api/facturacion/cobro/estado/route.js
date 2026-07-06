import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';
import { facturaConfigurado, facturaFetch } from '@/lib/factura-server';

// Estado de un cobro creado en Facturá (polling del POS).
// GET /api/facturacion/cobro/estado?cobro_id=<uuid>&token=<access_token>
export async function GET(request) {
  if (!facturaConfigurado()) return errorJson('Facturá no configurado.', 501);

  const url = new URL(request.url);
  const cobroId = url.searchParams.get('cobro_id');
  const token = url.searchParams.get('token');
  if (!cobroId || !token) return errorJson('Faltan datos', 400);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: negocio } = await supa.from('negocios').select('id').maybeSingle();
  if (!negocio?.id) return errorJson('No autorizado', 403);

  try {
    const data = await facturaFetch(negocio.id, `/api/partners/cobros/${cobroId}`);
    return Response.json({
      estado: data.cobro?.estado || 'pendiente',
      mp_payment_id: data.cobro?.mp_payment_id || null,
      factura: data.factura || null,
    });
  } catch (e) {
    return errorJson(`Facturá: ${e.message}`, 502);
  }
}
