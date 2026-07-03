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
  'Mercado Pago no está configurado. Cargá MP_ACCESS_TOKEN (y demás variables MP_*) en Vercel → Settings → Environment Variables.';
