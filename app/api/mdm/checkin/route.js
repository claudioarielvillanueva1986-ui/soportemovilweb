import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { errorJson } from '@/lib/mp-server';

// Respaldo del push de FCM: el agente llama esto cada 15 minutos. Confirma
// que sigue vivo y se lleva los comandos que hubieran quedado pendientes
// (por ejemplo si se perdió la notificación push).
// POST /api/mdm/checkin  { device_id, device_secret, fcm_token? }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { device_id, device_secret, fcm_token, lat, lng, precision } = body || {};
  if (!device_id || !device_secret) return errorJson('Faltan datos');

  const admin = createSupabaseAdminClient();
  const { data: dispositivo } = await admin
    .from('mdm_dispositivos')
    .select('id')
    .eq('id', device_id)
    .eq('device_secret', device_secret)
    .maybeSingle();
  if (!dispositivo) return errorJson('No autorizado', 401);

  const hayUbicacion = typeof lat === 'number' && typeof lng === 'number';
  await admin
    .from('mdm_dispositivos')
    .update({
      ultima_conexion: new Date().toISOString(),
      ...(fcm_token ? { fcm_token } : {}),
      ...(hayUbicacion ? { ultima_lat: lat, ultima_lng: lng, ultima_ubicacion_en: new Date().toISOString() } : {}),
    })
    .eq('id', device_id);

  if (hayUbicacion) {
    await admin.from('mdm_ubicaciones').insert({
      dispositivo_id: device_id,
      lat,
      lng,
      precision_m: typeof precision === 'number' ? precision : null,
    });
  }

  const { data: comandos } = await admin
    .from('mdm_comandos')
    .select('id, tipo, motivo')
    .eq('dispositivo_id', device_id)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true });

  if (comandos?.length) {
    await admin
      .from('mdm_comandos')
      .update({ estado: 'enviado' })
      .in('id', comandos.map((c) => c.id));
  }

  return Response.json({ comandos: comandos || [] });
}
