import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { errorJson } from '@/lib/mp-server';

// El agente confirma que ejecutó (o no pudo ejecutar) un comando.
// POST /api/mdm/comando-ack  { device_id, device_secret, comando_id, ok, error? }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { device_id, device_secret, comando_id, ok, error: errorMensaje } = body || {};
  if (!device_id || !device_secret || !comando_id) return errorJson('Faltan datos');

  const admin = createSupabaseAdminClient();
  const { data: dispositivo } = await admin
    .from('mdm_dispositivos')
    .select('id')
    .eq('id', device_id)
    .eq('device_secret', device_secret)
    .maybeSingle();
  if (!dispositivo) return errorJson('No autorizado', 401);

  const { data: comando } = await admin
    .from('mdm_comandos')
    .select('id, tipo, motivo')
    .eq('id', comando_id)
    .eq('dispositivo_id', device_id)
    .maybeSingle();
  if (!comando) return errorJson('Comando no encontrado', 404);

  await admin
    .from('mdm_comandos')
    .update({
      estado: ok ? 'confirmado' : 'error',
      error_mensaje: ok ? null : errorMensaje || 'Error desconocido',
      confirmado_en: new Date().toISOString(),
    })
    .eq('id', comando_id);

  if (ok) {
    const bloqueando = comando.tipo === 'bloquear';
    await admin
      .from('mdm_dispositivos')
      .update({
        estado: bloqueando ? 'bloqueado' : 'activo',
        motivo_bloqueo: bloqueando ? comando.motivo || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', device_id);
  }

  return Response.json({ ok: true });
}
