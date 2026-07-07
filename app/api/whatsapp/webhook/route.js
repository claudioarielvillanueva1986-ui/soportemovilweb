import { rpcConSecreto } from '@/lib/mp-server';
import { enviarWhatsApp, responderIA, waConfigurado } from '@/lib/whatsapp-cloud';

// Webhook de WhatsApp Cloud API (Meta).
// GET  → verificación del webhook (hub.challenge)
// POST → mensajes entrantes: guarda, y si la conversación está en modo bot, responde con IA.

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
          if (msg.type !== 'text') {
            // por ahora solo texto; avisamos amablemente si hay config
            await manejarNoTexto(phoneNumberId, msg.from).catch(() => {});
            continue;
          }
          const nombre = contactos.find((c) => c.wa_id === msg.from)?.profile?.name || '';
          await procesarMensaje({
            phoneNumberId,
            from: msg.from,
            nombre,
            texto: msg.text?.body || '',
            waId: msg.id,
          });
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

async function manejarNoTexto(phoneNumberId, from) {
  if (!waConfigurado()) return;
  await enviarWhatsApp({
    phoneNumberId,
    to: from,
    texto: 'Por ahora solo puedo leer mensajes de texto. Escribime tu consulta y te ayudo 🙂',
  });
}
