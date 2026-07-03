// Helpers de servidor para Mercado Pago (solo se importan desde app/api/**).
// Credenciales vía variables de entorno en Vercel — nunca en el código.
import { createClient } from '@supabase/supabase-js';

const MP_API = 'https://api.mercadopago.com';

export function mpConfigurado() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

export async function mpFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `MP respondió ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Cliente Supabase de servidor: escribe únicamente vía RPCs protegidas por secreto
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_Mt55U87PB1j61q_sqdx49Q_V54IAbNM'
);

export async function rpcConSecreto(fn, params) {
  const { data, error } = await supabaseServer.rpc(fn, {
    p_secret: process.env.MP_WEBHOOK_SECRET,
    ...params,
  });
  if (error) throw new Error(error.message);
  return data;
}

export function errorJson(mensaje, status = 400) {
  return Response.json({ error: mensaje }, { status });
}

export const NO_CONFIG_MSG =
  'Mercado Pago no está configurado. Cargá MP_ACCESS_TOKEN (y demás variables MP_*) en las variables de entorno.';

// ===== OAuth por negocio (cada taller conecta su propia cuenta MP) =====

import { createHmac } from 'crypto';

export function oauthConfigurado() {
  return Boolean(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);
}

export function firmarEstado(negocioId) {
  const firma = createHmac('sha256', process.env.MP_WEBHOOK_SECRET || '')
    .update(String(negocioId))
    .digest('hex')
    .slice(0, 24);
  return `${negocioId}.${firma}`;
}

export function verificarEstado(state) {
  const [negocioId, firma] = String(state || '').split('.');
  if (!negocioId || !firma) return null;
  return firmarEstado(negocioId) === state ? negocioId : null;
}

export async function mpFetchConToken(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `MP respondió ${res.status}`);
  }
  return data;
}

// Devuelve un access_token vigente del negocio, renovándolo si está por vencer.
export async function tokenVigente(ctx) {
  const porVencer =
    ctx.expires_at && new Date(ctx.expires_at) - Date.now() < 7 * 86400000;
  if (!porVencer || !ctx.refresh_token || !oauthConfigurado()) {
    return ctx.access_token;
  }
  const res = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: ctx.refresh_token,
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return ctx.access_token; // se intenta con el actual
  await rpcConSecreto('mp_guardar_conexion', {
    p_negocio_id: ctx.negocio_id,
    p_mp_user_id: String(data.user_id),
    p_access_token: data.access_token,
    p_refresh_token: data.refresh_token || null,
    p_public_key: data.public_key || null,
    p_live_mode: data.live_mode !== false,
    p_expires_at: new Date(Date.now() + (data.expires_in || 15552000) * 1000).toISOString(),
  });
  return data.access_token;
}

export const NO_CONECTADO_MSG =
  'Este negocio todavía no conectó su cuenta de Mercado Pago. El dueño puede hacerlo desde Configuración → Conectar Mercado Pago.';
