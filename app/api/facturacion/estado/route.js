import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';
import { facturaConfigurado, facturaFetch } from '@/lib/factura-server';

// Estado de la conexión con Facturá para la UI de Configuración: si ARCA y
// Mercado Pago ya quedaron listos del lado de Facturá.
// GET /api/facturacion/estado?negocio=<uuid>&token=<access_token>
export async function GET(request) {
  if (!facturaConfigurado()) return Response.json({ conectado: false, sin_config: true });

  const url = new URL(request.url);
  const negocio = url.searchParams.get('negocio');
  const token = url.searchParams.get('token');
  if (!negocio || !token) return errorJson('Falta el negocio o la sesión', 400);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: autorizado } = await supa.rpc('mp_puede_conectar', { p_negocio_id: negocio });
  if (!autorizado) return errorJson('No autorizado para este negocio.', 403);

  try {
    const info = await facturaFetch(negocio, '/api/partners/negocio');
    return Response.json({ conectado: true, ...info });
  } catch (e) {
    // No conectado todavía, o token vencido/revocado
    return Response.json({ conectado: false, detalle: e.message });
  }
}
