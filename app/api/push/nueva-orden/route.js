import webpush from 'web-push';
import { rpcConSecreto } from '@/lib/mp-server';
import { VAPID_PUBLIC_KEY } from '@/lib/push';

// Llamado por el trigger de la base cuando entra una orden nueva:
// manda push a todos los dispositivos suscriptos del negocio.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!body?.secret || body.secret !== process.env.MP_WEBHOOK_SECRET) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    return Response.json({ ok: true, detalle: 'push no configurado' });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:claudioarielvillanueva1986@gmail.com',
    process.env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const subs = await rpcConSecreto('push_subs_negocio', {
    p_negocio_id: body.negocio_id,
  });

  const payload = JSON.stringify({
    titulo: `Nueva orden ${body.numero}`,
    cuerpo: `${body.nombre} — ${body.dispositivo}`,
    url: '/panel/tickets',
  });

  await Promise.all(
    (subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await rpcConSecreto('push_borrar_endpoint', {
            p_endpoint: s.endpoint,
          }).catch(() => {});
        }
      }
    })
  );

  return Response.json({ ok: true, enviados: (subs || []).length });
}
