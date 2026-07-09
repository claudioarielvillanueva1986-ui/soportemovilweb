import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Entrega en tiempo real de comandos (bloquear/desbloquear) al agente MDM.
// FIREBASE_SERVICE_ACCOUNT_JSON = el JSON completo de la cuenta de servicio
// (Firebase Console → Configuración del proyecto → Cuentas de servicio →
// Generar clave privada nueva), pegado tal cual como variable de entorno.
export function firebaseConfigurado() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

function app() {
  if (getApps().length) return getApps()[0];
  const credenciales = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  return initializeApp({ credential: cert(credenciales) });
}

// Manda un mensaje de datos (sin notificación visible: el agente lo procesa
// en segundo plano). Si falla (token vencido, sin red, etc.) no rompe el
// flujo — el check-in periódico del equipo va a traer igual el comando
// pendiente la próxima vez.
export async function enviarComandoFcm(fcmToken, data) {
  if (!fcmToken || !firebaseConfigurado()) return { enviado: false, motivo: 'sin_token_o_config' };
  try {
    await getMessaging(app()).send({
      token: fcmToken,
      data,
      android: { priority: 'high' },
    });
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e.message };
  }
}
