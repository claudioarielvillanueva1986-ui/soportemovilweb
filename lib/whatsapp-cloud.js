// Helpers de servidor para WhatsApp Cloud API (Meta) + respuestas con IA (Claude).
// Solo se importan desde app/api/**. Credenciales por variables de entorno.
const GRAPH = 'https://graph.facebook.com/v21.0';

export function waConfigurado() {
  return Boolean(process.env.WHATSAPP_TOKEN);
}

// Envía un mensaje de texto por la Cloud API. Devuelve el wa_message_id.
export async function enviarWhatsApp({ phoneNumberId, to, texto }) {
  const pnid = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!pnid) throw new Error('Falta el phone_number_id de WhatsApp');
  const res = await fetch(`${GRAPH}/${pnid}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto?.slice(0, 4096) || '' },
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `WhatsApp ${res.status}`);
  return data?.messages?.[0]?.id || null;
}

const ESTADOS_TXT = {
  nuevo: 'recibida, en diagnóstico',
  presupuestado: 'con presupuesto para aprobar',
  aprobado: 'aprobada, en reparación',
  reparando: 'en reparación',
  listo: 'LISTA para retirar',
  entregado: 'entregada',
  cancelado: 'cancelada',
};

function historialAMensajes(historial = []) {
  // 'in' → user, 'out' → assistant; fusiona turnos consecutivos del mismo rol
  const msgs = [];
  for (const m of historial) {
    const role = m.direccion === 'in' ? 'user' : 'assistant';
    const texto = m.texto || '';
    if (!texto) continue;
    if (msgs.length && msgs[msgs.length - 1].role === role) {
      msgs[msgs.length - 1].content += `\n${texto}`;
    } else {
      msgs.push({ role, content: texto });
    }
  }
  // La API requiere que el primer mensaje sea del usuario
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) msgs.push({ role: 'user', content: 'Hola' });
  return msgs;
}

// Genera la respuesta del bot con Claude. Devuelve { texto, escalar }.
export async function responderIA({ negocioNombre, saludo, promptExtra, cliente, ordenes, historial }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');

  const ordenesTxt = (ordenes || []).length
    ? ordenes
        .map(
          (o) =>
            `- Orden ${o.numero}: ${o.marca_modelo || o.dispositivo || 'equipo'} — estado: ${
              ESTADOS_TXT[o.estado] || o.estado
            }${o.presupuesto != null ? ` — presupuesto $${o.presupuesto}` : ''}`
        )
        .join('\n')
    : 'No encontré órdenes asociadas a este número.';

  const system = [
    `Sos el asistente virtual de "${negocioNombre}", un taller de reparación de celulares y electrónica en Argentina.`,
    saludo ? `Tono e identidad: ${saludo}` : '',
    'Respondé SIEMPRE en español rioplatense, breve y cordial (mensajes cortos de WhatsApp, sin markdown).',
    'Podés ayudar con: estado de reparaciones, precios/consultas generales y horarios.',
    cliente?.nombre ? `El cliente es ${cliente.nombre}.` : '',
    `Órdenes asociadas a este teléfono:\n${ordenesTxt}`,
    'Reglas: no inventes datos ni estados; si te preguntan por una orden que no está en la lista, pedí el número de orden. ',
    'Si el cliente está enojado, pide un reclamo/humano, o es algo que no podés resolver, respondé con amabilidad que un compañero del taller lo va a contactar, y terminá tu mensaje con el texto exacto [ESCALAR].',
    promptExtra || '',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.WA_BOT_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system,
      messages: historialAMensajes(historial),
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Claude ${res.status}`);
  let texto = (data?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  const escalar = /\[ESCALAR\]/i.test(texto);
  texto = texto.replace(/\[ESCALAR\]/gi, '').trim();
  return { texto, escalar };
}
