import { randomUUID } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { errorJson } from '@/lib/mp-server';

// El agente Android llama esto una sola vez, justo después de terminar el
// aprovisionamiento por QR. Cambia el enroll_token (de un solo uso, viene
// del QR) por un device_id + device_secret permanentes.
// POST /api/mdm/enroll  { enroll_token, android_id, marca, modelo, fcm_token?, imei?, numero_serie? }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { enroll_token, android_id, marca, modelo, fcm_token, imei, numero_serie } = body || {};
  if (!enroll_token) return errorJson('Falta enroll_token');

  const admin = createSupabaseAdminClient();
  const { data: dispositivo } = await admin
    .from('mdm_dispositivos')
    .select('id, enroll_usado')
    .eq('enroll_token', enroll_token)
    .maybeSingle();

  if (!dispositivo) return errorJson('Código de alta inválido o ya usado', 404);
  if (dispositivo.enroll_usado) return errorJson('Código de alta ya usado', 409);

  const deviceSecret = randomUUID();
  const { error } = await admin
    .from('mdm_dispositivos')
    .update({
      device_secret: deviceSecret,
      enroll_usado: true,
      estado: 'activo',
      android_id: android_id || null,
      marca: marca || null,
      modelo: modelo || null,
      fcm_token: fcm_token || null,
      imei: imei || null,
      numero_serie: numero_serie || null,
      ultima_conexion: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', dispositivo.id);

  if (error) return errorJson(error.message, 500);

  return Response.json({ device_id: dispositivo.id, device_secret: deviceSecret });
}
