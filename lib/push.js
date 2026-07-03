// Clave pública VAPID (es pública por diseño; la privada vive en el servidor).
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BKAdKJ38qPme_YY3mKeAgdEPJIzQg9Fzg4bTWfA3Dt_MNJuNTvBKTyP5JoCIwsKjdZRPmmH-Ay8G7Gz7TZrZKjo';

function base64aUint8(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSoportado() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function registrarSW() {
  if (!pushSoportado()) return null;
  return navigator.serviceWorker.register('/sw.js');
}

// Activa las notificaciones para este dispositivo y devuelve la suscripción.
export async function suscribirPush() {
  const reg = await navigator.serviceWorker.ready;
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64aUint8(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  };
}
