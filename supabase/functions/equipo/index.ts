// Edge Function: gestión de equipo (alta/baja de operadores).
// Requiere rol dueño. Usa el service role (inyectado por Supabase) SOLO acá
// dentro, nunca en el cliente. El alta crea la cuenta con contraseña y email
// confirmado (sin depender de SMTP): el dueño comparte las credenciales.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Falta la sesión' }, 401);

  // Cliente con el token del usuario → resuelve identidad y valida que sea dueño.
  const asUser = createClient(URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData?.user) return json({ error: 'Sesión inválida' }, 401);

  const [{ data: esDueno }, { data: negocioId }] = await Promise.all([
    asUser.rpc('es_dueno'),
    asUser.rpc('mi_negocio'),
  ]);
  if (!esDueno || !negocioId) return json({ error: 'Solo el dueño puede gestionar el equipo' }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }
  const accion = String(payload.accion || '');
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  if (accion === 'crear') {
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const nombre = String(payload.nombre || '').trim();
    const rol = payload.rol === 'dueno' ? 'dueno' : 'operador';
    if (!email || !email.includes('@')) return json({ error: 'Email inválido' }, 400);
    if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
    if (!nombre) return json({ error: 'Indicá el nombre' }, 400);

    const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (eCrear || !creado?.user) {
      const msg = /already been registered|already exists/i.test(eCrear?.message || '')
        ? 'Ya existe una cuenta con ese email'
        : eCrear?.message || 'No se pudo crear la cuenta';
      return json({ error: msg }, 400);
    }

    const { error: ePerfil } = await admin.from('perfiles').insert({
      user_id: creado.user.id,
      nombre,
      rol,
      negocio_id: negocioId,
      activo: true,
      email,
    });
    if (ePerfil) {
      // rollback del auth user para no dejar cuentas huérfanas
      await admin.auth.admin.deleteUser(creado.user.id);
      return json({ error: ePerfil.message }, 400);
    }
    return json({ ok: true, user_id: creado.user.id });
  }

  if (accion === 'eliminar') {
    const userId = String(payload.user_id || '');
    if (!userId) return json({ error: 'Falta el usuario' }, 400);
    if (userId === userData.user.id) return json({ error: 'No podés eliminarte a vos mismo' }, 400);

    // el perfil debe pertenecer al mismo negocio
    const { data: perfil } = await admin
      .from('perfiles')
      .select('user_id, negocio_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!perfil || perfil.negocio_id !== negocioId) return json({ error: 'Usuario no encontrado' }, 404);

    // el trigger proteger_ultimo_dueno igual bloquea si es el último dueño
    const { error: eDel } = await admin.from('perfiles').delete().eq('user_id', userId);
    if (eDel) return json({ error: eDel.message }, 400);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return json({ ok: true });
  }

  return json({ error: 'Acción desconocida' }, 400);
});
