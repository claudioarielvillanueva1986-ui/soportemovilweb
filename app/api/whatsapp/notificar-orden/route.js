import { createClient } from '@supabase/supabase-js';
import { errorJson } from '@/lib/mp-server';
import { enviarWhatsApp, waConfigurado } from '@/lib/whatsapp-cloud';
import { construirMensaje, telWhatsApp, PLANTILLA_RECIBIDO_DEFECTO, PLANTILLA_LISTO_DEFECTO } from '@/lib/whatsapp';

// Aviso automático real por WhatsApp (Cloud API, Meta) al cliente cuando una
// orden se recibe o queda lista — dispara solo desde el servidor, sin que el
// operador tenga que abrir un link wa.me a mano. Si el negocio no tiene la
// Cloud API conectada o la orden no tiene teléfono, no hace nada: nunca debe
// romper el flujo de crear/actualizar la orden por un problema de WhatsApp.
// POST /api/whatsapp/notificar-orden (Bearer) { ticket_id, tipo: 'recibido'|'listo' }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Body inválido');
  }
  const { ticket_id: ticketId, tipo } = body || {};
  if (!ticketId || !['recibido', 'listo'].includes(tipo)) return errorJson('Faltan datos');

  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return errorJson('Sesión requerida', 401);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const [{ data: ticket }, { data: negocio }, { data: cfg }] = await Promise.all([
    supa.from('tickets').select('*').eq('id', ticketId).maybeSingle(),
    supa.from('negocios').select('nombre, wa_aviso_recibido, wa_aviso_listo').maybeSingle(),
    supa.from('wa_config').select('phone_number_id').maybeSingle(),
  ]);
  if (!ticket) return errorJson('Orden no encontrada', 404);
  if (!waConfigurado() || !cfg?.phone_number_id) {
    return Response.json({ enviado: false, motivo: 'WhatsApp Cloud API no está conectado.' });
  }
  const tel = telWhatsApp(ticket.telefono);
  if (!tel) {
    return Response.json({ enviado: false, motivo: 'La orden no tiene un teléfono válido.' });
  }

  const plantilla =
    tipo === 'listo'
      ? negocio?.wa_aviso_listo || PLANTILLA_LISTO_DEFECTO
      : negocio?.wa_aviso_recibido || PLANTILLA_RECIBIDO_DEFECTO;
  const host = (process.env.NEXT_PUBLIC_APP_URL || 'https://soportemovil.netlify.app').replace(/^https?:\/\//, '');
  const texto = construirMensaje(plantilla, { ticket, negocio: negocio?.nombre, host });

  try {
    await enviarWhatsApp({ phoneNumberId: cfg.phone_number_id, to: tel, texto });
    return Response.json({ enviado: true });
  } catch (e) {
    return Response.json({ enviado: false, motivo: e.message });
  }
}
