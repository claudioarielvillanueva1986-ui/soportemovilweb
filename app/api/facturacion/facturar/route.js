import { createClient } from '@supabase/supabase-js';
import { errorJson, rpcConSecreto } from '@/lib/mp-server';
import { facturaConfigurado, facturaFetch } from '@/lib/factura-server';

// Emite la factura de una venta en ARCA, a través de Facturá, con los ítems
// del carrito. Idempotente: si la venta ya fue facturada, devuelve la factura.
// POST /api/facturacion/facturar  (Bearer)  { venta_id }
export async function POST(request) {
  if (!facturaConfigurado()) return errorJson('Facturá no está configurado.', 501);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const ventaId = body?.venta_id;
  if (!ventaId) return errorJson('Falta venta_id');

  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: negocio } = await supa.from('negocios').select('id').maybeSingle();
  if (!negocio?.id) return errorJson('No autorizado', 403);

  // Venta (RLS asegura que sea del negocio del usuario)
  const { data: venta } = await supa
    .from('ventas')
    .select('id, cliente_id, facturada_en, factura_id, factura_cae, factura_pdf_url')
    .eq('id', ventaId)
    .maybeSingle();
  if (!venta) return errorJson('Venta no encontrada', 404);

  // Idempotencia: ya facturada
  if (venta.facturada_en) {
    return Response.json({
      ya_facturada: true,
      factura_id: venta.factura_id,
      cae: venta.factura_cae,
      pdf_url: venta.factura_pdf_url,
    });
  }

  const { data: items } = await supa
    .from('venta_items')
    .select('cantidad, precio_unitario, descripcion, productos(nombre)')
    .eq('venta_id', ventaId);

  if (!items || items.length === 0) return errorJson('La venta no tiene ítems', 422);

  const pItems = items.map((i) => ({
    descripcion: i.descripcion || i.productos?.nombre || 'Producto',
    cantidad: Number(i.cantidad) || 1,
    precio_unitario: Number(i.precio_unitario) || 0,
  }));

  let receptor = null;
  if (venta.cliente_id) {
    const { data: cli } = await supa
      .from('clientes')
      .select('nombre, dni, email, telefono')
      .eq('id', venta.cliente_id)
      .maybeSingle();
    if (cli) {
      receptor = {
        doc_nro: cli.dni || '',
        nombre: cli.nombre || 'Consumidor Final',
        email: cli.email || '',
        telefono: cli.telefono || '',
        condicion_iva: 'consumidor_final',
      };
    }
  }

  try {
    const fact = await facturaFetch(negocio.id, '/api/partners/facturas', {
      method: 'POST',
      body: { receptor, items: pItems, tipo: null, emitir: true },
    });
    const f = fact.factura || {};
    await rpcConSecreto('factura_guardar_resultado', {
      p_venta_id: ventaId,
      p_factura_id: f.id || null,
      p_cae: f.cae || null,
      p_pdf_url: fact.pdf_url || null,
    });
    return Response.json({
      factura_id: f.id,
      numero: f.numero,
      tipo: f.tipo,
      cae: f.cae,
      pdf_url: fact.pdf_url || null,
    });
  } catch (e) {
    return errorJson(`Facturá: ${e.message}`, 502);
  }
}
