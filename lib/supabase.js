import { createClient } from '@supabase/supabase-js';

// La clave publishable de Supabase es pública por diseño: la seguridad
// la garantizan las políticas RLS y las funciones RPC del backend.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const ESTADOS = {
  nuevo: { label: 'Nuevo', color: '#3b82f6' },
  en_revision: { label: 'En revisión', color: '#8b5cf6' },
  presupuestado: { label: 'Presupuesto enviado', color: '#eab308' },
  en_reparacion: { label: 'En reparación', color: '#f59e0b' },
  esperando_repuesto: { label: 'Esperando repuesto', color: '#f97316' },
  listo: { label: 'Listo para retirar', color: '#22c55e' },
  entregado: { label: 'Entregado', color: '#10b981' },
  cancelado: { label: 'Cancelado', color: '#ef4444' },
};

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
