import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';

const GRAPH = 'https://graph.facebook.com/v21.0';

// Sirve un adjunto de WhatsApp (imagen/audio/video/documento) autenticado.
// No se guarda copia propia del archivo: el media_id de Meta no vence, la
// URL firmada que devuelve la Graph API sí (minutos), así que se resuelve
// "en vivo" en cada pedido. El acceso queda protegido por la misma RLS de
// wa_mensajes (solo ve el adjunto quien puede ver ese mensaje).
export async function GET(request, { params }) {
  const { mediaId } = await params;
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);
  if (!process.env.WHATSAPP_TOKEN) return errorJson('WhatsApp no configurado', 501);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: msg } = await supa
    .from('wa_mensajes')
    .select('id, media_mime')
    .eq('media_id', mediaId)
    .maybeSingle();
  if (!msg) return errorJson('No encontrado', 404);

  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    cache: 'no-store',
  });
  const meta = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok || !meta.url) return errorJson('No se pudo resolver el adjunto (puede haber vencido)', 502);

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    cache: 'no-store',
  });
  if (!fileRes.ok || !fileRes.body) return errorJson('No se pudo descargar el adjunto', 502);

  return new Response(fileRes.body, {
    headers: {
      'Content-Type': msg.media_mime || meta.mime_type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
