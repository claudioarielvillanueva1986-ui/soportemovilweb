import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { errorJson } from '@/lib/mp-server';
import { enviarComandoFcm } from '@/lib/firebase-admin';

// Lo llama un cron job de Supabase (pg_cron + pg_net) una vez por día. Busca
// equipos activos cuya "próxima cuota" ya venció y les encola un bloqueo
// automático — mismo mecanismo que el bloqueo manual desde el panel
// (mdm_comandos + push FCM), así que si el equipo está offline lo va a
// tomar igual en su próximo check-in (hasta 15 min).
// POST /api/mdm/verificar-vencimientos  (header x-cron-secret)
export async function POST(request) {
  const secret = request.headers.get('x-cron-secret') || '';
  if (!process.env.MDM_CRON_SECRET || secret !== process.env.MDM_CRON_SECRET) {
    return errorJson('No autorizado', 401);
  }

  const admin = createSupabaseAdminClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: vencidos, error } = await admin
    .from('mdm_dispositivos')
    .select('id, fcm_token, proxima_cuota_vence')
    .eq('estado', 'activo')
    .not('proxima_cuota_vence', 'is', null)
    .lt('proxima_cuota_vence', hoy);
  if (error) return errorJson(error.message, 500);

  const bloqueados = [];
  for (const dispositivo of vencidos || []) {
    const { data: pendiente } = await admin
      .from('mdm_comandos')
      .select('id')
      .eq('dispositivo_id', dispositivo.id)
      .eq('tipo', 'bloquear')
      .in('estado', ['pendiente', 'enviado'])
      .maybeSingle();
    if (pendiente) continue;

    const motivo = `Cuota vencida el ${dispositivo.proxima_cuota_vence} (bloqueo automático)`;
    const { data: comando, error: errComando } = await admin
      .from('mdm_comandos')
      .insert({ dispositivo_id: dispositivo.id, tipo: 'bloquear', motivo })
      .select('id')
      .single();
    if (errComando) continue;

    await enviarComandoFcm(dispositivo.fcm_token, {
      tipo: 'bloquear',
      comando_id: comando.id,
      motivo,
    });
    bloqueados.push(dispositivo.id);
  }

  return Response.json({ revisados: vencidos?.length || 0, bloqueados });
}
