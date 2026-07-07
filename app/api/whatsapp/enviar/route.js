import { createClient } from '@supabase/supabase-js';
import { errorJson, rpcConSecreto } from '@/lib/mp-server';
import { enviarWhatsApp, waConfigurado } from '@/lib/whatsapp-cloud';

// Respuesta manual del operador desde la bandeja del panel.
// POST /api/whatsapp/enviar (Bearer) { conversacion_id, texto }
export async function POST(request) {
  if (!waConfigurado()) return errorJson('WhatsApp no está configurado.', 501);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { conversacion_id: convId, texto } = body || {};
  if (!convId || !texto?.trim()) return errorJson('Falta la conversación o el texto');

  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  // RLS asegura que la conversación sea del negocio del usuario
  const { data: conv } = await supa
    .from('wa_conversaciones')
    .select('id, wa_telefono, negocio_id')
    .eq('id', convId)
    .maybeSingle();
  if (!conv) return errorJson('Conversación no encontrada', 404);

  const { data: cfg } = await supa
    .from('wa_config')
    .select('phone_number_id')
    .maybeSingle();

  try {
    const waMsgId = await enviarWhatsApp({
      phoneNumberId: cfg?.phone_number_id,
      to: conv.wa_telefono,
      texto: texto.trim(),
    });
    await rpcConSecreto('wa_guardar_saliente', {
      p_conversacion_id: convId,
      p_texto: texto.trim(),
      p_autor: 'operador',
      p_wa_id: waMsgId,
    });
    // al responder manualmente, la conversación pasa a modo humano
    await supa.rpc('wa_tomar', { p_id: convId, p_modo: 'humano' });
    return Response.json({ ok: true });
  } catch (e) {
    return errorJson(`WhatsApp: ${e.message}`, 502);
  }
}
