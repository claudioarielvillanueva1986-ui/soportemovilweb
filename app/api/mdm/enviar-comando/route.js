import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';
import { enviarComandoFcm } from '@/lib/firebase-admin';

// El panel llama esto para bloquear/desbloquear un equipo. Encola el
// comando (RPC, respeta el negocio del usuario) y lo manda por push al
// toque; si el push falla o el equipo está offline, el check-in periódico
// del agente lo va a traer igual la próxima vez.
// POST /api/mdm/enviar-comando  (Bearer del usuario)  { dispositivo_id, tipo, motivo? }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { dispositivo_id, tipo, motivo } = body || {};
  if (!dispositivo_id || !['bloquear', 'desbloquear'].includes(tipo)) {
    return errorJson('Faltan datos o tipo inválido');
  }

  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data, error } = await supa.rpc('mdm_encolar_comando', {
    p_dispositivo_id: dispositivo_id,
    p_tipo: tipo,
    p_motivo: motivo || null,
  });
  if (error) return errorJson(error.message, 400);

  const fila = Array.isArray(data) ? data[0] : data;
  const push = await enviarComandoFcm(fila?.fcm_token, {
    tipo,
    comando_id: fila?.comando_id,
    motivo: motivo || '',
  });

  return Response.json({ comando_id: fila?.comando_id, estado: 'pendiente', push });
}
