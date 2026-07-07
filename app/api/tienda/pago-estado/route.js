import { errorJson, rpcConSecreto } from '@/lib/mp-server';
import { facturaConfigurado, facturaFetch } from '@/lib/factura-server';

// Estado del pago de un pedido (polling desde la tienda pública).
// GET /api/tienda/pago-estado?pedido_id=<uuid>
export async function GET(request) {
  const pedidoId = new URL(request.url).searchParams.get('pedido_id');
  if (!pedidoId) return errorJson('Falta el pedido', 400);

  const p = await rpcConSecreto('pedido_para_pago', { p_pedido_id: pedidoId });
  if (!p) return errorJson('Pedido no encontrado', 404);
  if (p.estado === 'pagado') return Response.json({ pagado: true });
  if (!p.cobro_id || !facturaConfigurado()) return Response.json({ pagado: false });

  try {
    const data = await facturaFetch(p.negocio_id, `/api/partners/cobros/${p.cobro_id}`);
    const estado = data.cobro?.estado || 'pendiente';
    if (estado === 'aprobado' || estado === 'approved' || estado === 'pagado') {
      await rpcConSecreto('pedido_marcar_pagado', { p_pedido_id: pedidoId });
      return Response.json({ pagado: true });
    }
    return Response.json({ pagado: false, estado });
  } catch (e) {
    return Response.json({ pagado: false, error: e.message });
  }
}
