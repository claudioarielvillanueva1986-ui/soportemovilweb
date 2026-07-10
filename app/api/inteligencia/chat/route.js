import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';
import { responderChatInteligencia } from '@/lib/inteligencia-ia';

// POST /api/inteligencia/chat (Bearer) { dias, historial: [{rol:'usuario'|'asistente', texto}] }
// Chat libre sobre los datos reales del negocio (misma fuente que /analisis,
// re-consultada acá para no confiar en cifras que mande el cliente).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const dias = Number(body?.dias) || 90;
  const historial = Array.isArray(body?.historial) ? body.historial : [];
  if (!historial.length) return errorJson('Falta el mensaje');

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
    const texto = await responderChatInteligencia({ datos, negocioNombre: negocio?.nombre || 'el taller', historial });
    return Response.json({ texto });
  } catch (e) {
    return errorJson(e.message, 502);
  }
}
