import { ESTADOS, formatMoney } from './supabase';

// Normaliza un teléfono argentino a formato wa.me (solo dígitos, con 54)
export function telWhatsApp(telefono) {
  let d = String(telefono || '').replace(/\D/g, '');
  if (!d) return null;
  d = d.replace(/^0+/, '');
  if (!d.startsWith('54')) d = '54' + d;
  return d;
}

export function linkAvisoWhatsApp({ ticket, negocio, host }) {
  const tel = telWhatsApp(ticket.telefono);
  if (!tel) return null;
  const equipo = ticket.marca_modelo || ticket.dispositivo;
  let msj;
  if (ticket.estado === 'listo') {
    msj = `Hola ${ticket.nombre}! Te escribimos de ${negocio}. Tu ${equipo} (orden ${ticket.numero}) ya está LISTO para retirar. ¡Te esperamos!`;
  } else if (ticket.estado === 'presupuestado' && ticket.presupuesto != null) {
    msj = `Hola ${ticket.nombre}! Te escribimos de ${negocio} por tu ${equipo} (orden ${ticket.numero}). El presupuesto de la reparación es ${formatMoney(ticket.presupuesto)}. Podés aprobarlo online en https://${host}/consulta con tu número de orden y email, o respondernos por acá.`;
  } else {
    const estado = ESTADOS[ticket.estado]?.label || ticket.estado;
    msj = `Hola ${ticket.nombre}! Te escribimos de ${negocio} por tu ${equipo} (orden ${ticket.numero}). Estado actual: ${estado}. Podés seguirla online en https://${host}/consulta`;
  }
  return `https://wa.me/${tel}?text=${encodeURIComponent(msj)}`;
}
