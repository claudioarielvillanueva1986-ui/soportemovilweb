import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';
import { facturaConfigurado, facturaFetch } from '@/lib/factura-server';

// Crea un cobro de Mercado Pago a través de Facturá (usa la cuenta MP que el
// taller conectó en Facturá). El POS lo dispara al elegir "Cobrar con QR".
// facturar=false: la venta se factura aparte, con los ítems del carrito.
// POST /api/facturacion/cobro  (Bearer del usuario)  { monto, descripcion, external_reference? }
export async function POST(request) {
  if (!facturaConfigurado()) {
    return errorJson('La integración con Facturá no está configurada.', 501);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { monto, descripcion, external_reference } = body || {};
  if (!monto || Number(monto) <= 0) return errorJson('Monto inválido');

  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: negocio } = await supa.from('negocios').select('id').maybeSingle();
  if (!negocio?.id) return errorJson('No autorizado', 403);

  const bodyBase = {
    monto: Number(monto),
    descripcion: descripcion || 'Venta en mostrador',
    external_reference: external_reference || null,
    facturar: false,
  };

  // Primero intentamos el QR real de Mercado Pago (metodo="qr_dinamico"):
  // a diferencia del link de Checkout Pro, ese SÍ lo reconoce el lector de
  // la app de MP. Si el negocio todavía no tiene Tienda/Caja configurada en
  // Facturá (falta la dirección), caemos al link de Checkout Pro de
  // siempre — no rompe nada, solo no tiene el QR real hasta que la carguen.
  try {
    const cobro = await facturaFetch(negocio.id, '/api/partners/cobros', {
      method: 'POST',
      body: { ...bodyBase, metodo: 'qr_dinamico' },
    });
    return Response.json({
      cobro_id: cobro.cobro_id,
      estado: cobro.estado,
      metodo: 'qr_dinamico',
      qr_data: cobro.qr_data,
    });
  } catch (e) {
    console.warn('Facturá qr_dinamico no disponible, usando Checkout Pro:', e.message);
  }

  try {
    const cobro = await facturaFetch(negocio.id, '/api/partners/cobros', {
      method: 'POST',
      body: bodyBase,
    });
    return Response.json({
      cobro_id: cobro.cobro_id,
      init_point: cobro.init_point,
      estado: cobro.estado,
      metodo: 'qr',
    });
  } catch (e) {
    return errorJson(`Facturá: ${e.message}`, 502);
  }
}
