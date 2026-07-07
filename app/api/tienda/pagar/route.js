import { errorJson, rpcConSecreto } from '@/lib/mp-server';
import { facturaConfigurado, facturaFetch } from '@/lib/factura-server';

// Inicia el pago online de un pedido de la tienda (público) vía Facturá (MP del taller).
// POST /api/tienda/pagar  { pedido_id }
export async function POST(request) {
  if (!facturaConfigurado()) return errorJson('El pago online no está disponible en esta tienda.', 501);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const pedidoId = body?.pedido_id;
  if (!pedidoId) return errorJson('Falta el pedido');

  const p = await rpcConSecreto('pedido_para_pago', { p_pedido_id: pedidoId });
  if (!p) return errorJson('Pedido no encontrado', 404);
  if (p.estado === 'pagado') return Response.json({ ya_pagado: true });
  if (!(Number(p.total) > 0)) return errorJson('Monto inválido');

  try {
    const cobro = await facturaFetch(p.negocio_id, '/api/partners/cobros', {
      method: 'POST',
      body: {
        monto: Number(p.total),
        descripcion: `Pedido tienda #${p.numero}`,
        external_reference: `pedido:${pedidoId}`,
        facturar: false,
      },
    });
    if (cobro.cobro_id) {
      await rpcConSecreto('pedido_set_cobro', { p_pedido_id: pedidoId, p_cobro_id: cobro.cobro_id });
    }
    return Response.json({ init_point: cobro.init_point, cobro_id: cobro.cobro_id });
  } catch (e) {
    return errorJson(`No se pudo iniciar el pago: ${e.message}`, 502);
  }
}
