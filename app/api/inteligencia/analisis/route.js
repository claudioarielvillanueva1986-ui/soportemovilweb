import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';
import { generarEstrategias } from '@/lib/inteligencia-ia';

// POST /api/inteligencia/analisis (Bearer) { dias }
// Trae los datos agregados reales del negocio (RLS + es_dueno() vía la RPC)
// y le pide a Claude el análisis — nunca confía en datos que mande el cliente.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const dias = Number(body?.dias) || 90;

  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const [{ data: datos, error: errDatos }, { data: negocio }] = await Promise.all([
    supa.rpc('inteligencia_ventas_datos', { p_dias: dias }),
    supa.from('negocios').select('nombre').maybeSingle(),
  ]);
  if (errDatos) return errorJson(errDatos.message, 403);

  try {
    const analisis = await generarEstrategias(datos, negocio?.nombre || 'el taller');
    return Response.json({ datos, analisis });
  } catch (e) {
    return errorJson(e.message, 502);
  }
}
