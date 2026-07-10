import { ESTADOS } from './supabase';

// Normaliza un teléfono argentino a formato wa.me (solo dígitos, con 54)
export function telWhatsApp(telefono) {
  let d = String(telefono || '').replace(/\D/g, '');
  if (!d) return null;
  d = d.replace(/^0+/, '');
  if (!d.startsWith('54')) d = '54' + d;
  return d;
}

// Plantillas por defecto (si el negocio no configuró las suyas)
export const PLANTILLA_RECIBIDO_DEFECTO =
  'Hola {cliente}! 👋 Recibimos tu {equipo} en {taller}. Tu orden es {numero}. Te avisamos apenas esté lista. Podés seguirla acá: {link}';
export const PLANTILLA_LISTO_DEFECTO =
  'Hola {cliente}! ✅ Tu {equipo} (orden {numero}) ya está listo para retirar en {taller}. ¡Te esperamos!';
export const PLANTILLA_PRESUPUESTO_DEFECTO =
  'Hola {cliente}! 📋 El presupuesto para tu {equipo} (orden {numero}) es de {monto}. Cualquier duda, escribinos por acá.';

// Reemplaza los marcadores {cliente} {equipo} {numero} {taller} {link} {estado} {monto}
export function construirMensaje(plantilla, { ticket, negocio, host }) {
  const equipo = ticket.marca_modelo || ticket.dispositivo || 'equipo';
  const link = host ? `https://${host}/consulta` : '/consulta';
  const estado = ESTADOS[ticket.estado]?.label || ticket.estado || '';
  const monto = ticket.presupuesto != null ? `$${Number(ticket.presupuesto).toLocaleString('es-AR')}` : '';
  return String(plantilla || '')
    .replaceAll('{cliente}', ticket.nombre || '')
    .replaceAll('{equipo}', equipo)
    .replaceAll('{numero}', ticket.numero || '')
    .replaceAll('{taller}', negocio || '')
    .replaceAll('{link}', link)
    .replaceAll('{estado}', estado)
    .replaceAll('{monto}', monto);
}

// Devuelve el link wa.me para avisar al cliente.
// tipo: 'recibido' | 'listo' | 'presupuesto'. Usa la plantilla del negocio o la de defecto.
export function linkAvisoWhatsApp({ ticket, tipo, plantillas = {}, negocio, host }) {
  const tel = telWhatsApp(ticket.telefono);
  if (!tel) return null;
  const plantilla =
    tipo === 'listo'
      ? plantillas.listo || PLANTILLA_LISTO_DEFECTO
      : tipo === 'presupuesto'
      ? plantillas.presupuesto || PLANTILLA_PRESUPUESTO_DEFECTO
      : plantillas.recibido || PLANTILLA_RECIBIDO_DEFECTO;
  const msj = construirMensaje(plantilla, { ticket, negocio, host });
  return `https://wa.me/${tel}?text=${encodeURIComponent(msj)}`;
}
