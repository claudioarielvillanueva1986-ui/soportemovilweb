import { rpcConSecreto } from '@/lib/mp-server';
import { enviarWhatsApp, responderIA, waConfigurado } from '@/lib/whatsapp-cloud';

// Webhook de WhatsApp Cloud API (Meta).
// GET  → verificación del webhook (hub.challenge)
// POST → mensajes entrantes: guarda, y si la conversación está en modo bot, responde con IA.

// Tipos de medio que WhatsApp puede mandar y que guardamos (el archivo en sí
// no se descarga acá — solo el media_id, que se resuelve al vuelo desde
// /api/whatsapp/media/[mediaId] cuando alguien lo mira en el panel).
const MEDIA_TIPOS = { image: 'imagen', audio: 'audio', video: 'video', document: 'documento', sticker: 'imagen' };
const MEDIA_ETIQUETAS = {
  image: '📷 Imagen',
  audio: '🎤 Audio',
  video: '🎥 Video',
  document: '📄 Documento',
  sticker: '🩹 Sticker',
};

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || '', { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value?.metadata?.phone_number_id;
        const contactos = value?.contacts || [];
        for (const msg of value.messages || []) {
          const nombre = contactos.find((c) => c.wa_id === msg.from)?.profile?.name || '';
          if (msg.type === 'text') {
            await procesarMensaje({
              phoneNumberId,
              from: msg.from,
              nombre,
              texto: msg.text?.body || '',
              waId: msg.id,
            });
          } else if (MEDIA_TIPOS[msg.type]) {
            await procesarMedia({ phoneNumberId, from: msg.from, nombre, msg });
          } else {
            // ubicación, contactos, etc: por ahora solo avisamos
            await manejarNoTexto(phoneNumberId, msg.from).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    // nunca fallamos ante Meta (reintentaría); registramos y devolvemos 200
    console.error('whatsapp webhook', e?.message);
  }
  return new Response('ok', { status: 200 });
}

async function procesarMensaje({ phoneNumberId, from, nombre, texto, waId }) {
  const ctx = await rpcConSecreto('wa_guardar_entrante', {
    p_phone_number_id: phoneNumberId,
    p_from: from,
    p_nombre: nombre,
    p_texto: texto,
    p_wa_id: waId,
  });
  if (!ctx) return; // sin config para ese número
  // Número bloqueado: se guarda el mensaje pero el bot no responde.
  if (ctx.bloqueado) return;
  // Si un humano tomó la conversación o el bot está apagado, no auto-respondemos.
  if (ctx.modo === 'humano' || !ctx.bot_activo) return;
  if (!waConfigurado() || !process.env.ANTHROPIC_API_KEY) return;

  const { texto: respuesta, escalar } = await responderIA({
    negocioNombre: ctx.negocio_nombre,
    saludo: ctx.saludo,
    promptExtra: ctx.prompt_extra,
    cliente: ctx.cliente,
    ordenes: ctx.ordenes,
    historial: ctx.historial,
  });

  if (respuesta) {
    const waMsgId = await enviarWhatsApp({ phoneNumberId, to: from, texto: respuesta });
    await rpcConSecreto('wa_guardar_saliente', {
      p_conversacion_id: ctx.conversacion_id,
      p_texto: respuesta,
      p_autor: 'bot',
      p_wa_id: waMsgId,
    });
  }
  if (escalar) {
    await rpcConSecreto('wa_set_modo', {
      p_conversacion_id: ctx.conversacion_id,
      p_modo: 'humano',
    });
  }
}

async function procesarMedia({ phoneNumberId, from, nombre, msg }) {
  const tipo = MEDIA_TIPOS[msg.type];
  const media = msg[msg.type] || {};
  const texto = media.caption || MEDIA_ETIQUETAS[msg.type] || 'Adjunto';
  const ctx = await rpcConSecreto('wa_guardar_entrante', {
    p_phone_number_id: phoneNumberId,
    p_from: from,
    p_nombre: nombre,
    p_texto: texto,
    p_wa_id: msg.id,
    p_tipo: tipo,
    p_media_id: media.id || null,
    p_media_mime: media.mime_type || null,
  });
  // Los adjuntos quedan en la bandeja para que el local los mire — el bot no
  // "ve" imágenes/audios, así que no intentamos responder automáticamente.
  void ctx;
}

async function manejarNoTexto(phoneNumberId, from) {
  if (!waConfigurado()) return;
  await enviarWhatsApp({
    phoneNumberId,
    to: from,
    texto: 'Por ahora solo puedo leer mensajes de texto. Escribime tu consulta y te ayudo 🙂',
  });
}
