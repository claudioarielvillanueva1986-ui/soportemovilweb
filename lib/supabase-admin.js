import { createClient } from '@supabase/supabase-js';

// Cliente de servicio (bypassa RLS) — solo para las rutas del agente MDM,
// que no son un usuario logueado de Supabase: se autentican con el
// enroll_token (una vez) o el device_secret (siempre después), no con un
// Bearer de sesión. Nunca se importa desde código de cliente.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzgvilcqkmdirxgtsilh.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
