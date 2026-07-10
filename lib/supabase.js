import { createClient } from '@supabase/supabase-js';

// La clave publishable de Supabase es pública por diseño: la seguridad
// la garantizan las políticas RLS y las funciones RPC del backend.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Soporte Móvil es el sistema de gestión de este negocio (no un SaaS
// multi-tenant a la venta): el dominio raíz muestra directamente su tienda.
export const NEGOCIO_SLUG = process.env.NEXT_PUBLIC_NEGOCIO_SLUG || 'soporte-movil';

// Mismo vocabulario y colores que v1 (Recibido/En Proceso/Reparado/Entregado/
// No Reparado/Entregado (S/R)/Cancelado) — los empleados ya lo tienen
// memorizado. "Entregado (S/R)" solo se alcanza devolviendo el equipo sin
// reparar (no es una opción manual del combo, ver ESTADOS_SELECCIONABLES).
export const ESTADOS = {
  recibido: { label: 'Recibido', color: '#F59E0B' },
  en_proceso: { label: 'En Proceso', color: '#0099D6' },
  reparado: { label: 'Reparado', color: '#34D399' },
  entregado: { label: 'Entregado', color: '#9CA3AF' },
  no_reparado: { label: 'No Reparado', color: '#F87171' },
  entregado_sr: { label: 'Entregado (S/R)', color: '#6B7280' },
  cancelado: { label: 'Cancelado', color: '#EF4444' },
};

// Opciones del combo manual "Cambiar estado" — igual que v1, sin
// "Entregado (S/R)" (ese solo se llega devolviendo el equipo sin reparar).
export const ESTADOS_SELECCIONABLES = ['recibido', 'en_proceso', 'reparado', 'entregado', 'no_reparado', 'cancelado'];

// Etiquetas de la orden — mismas 6 de v1 ("Presupuesto enviado" y
// "Esperando repuesto" eran estados propios en v2; en v1 son etiquetas).
export const ETIQUETAS_TICKET = [
  { tag: 'Urgente', color: '#DC2626' },
  { tag: 'Garantía', color: '#7C3AED' },
  { tag: 'Sin pago', color: '#D97706' },
  { tag: 'Esperando repuesto', color: '#0369A1' },
  { tag: 'Cliente avisado', color: '#059669' },
  { tag: 'Presupuesto enviado', color: '#0099D6' },
];

export const PRIORIDADES = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const METODOS_PAGO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  mercadopago_qr: 'Mercado Pago QR',
  mercadopago_point: 'Mercado Pago Point',
};

export const CATEGORIAS = {
  repuesto: 'Repuesto',
  accesorio: 'Accesorio',
  servicio: 'Servicio',
  otro: 'Otro',
};

export function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

export function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
