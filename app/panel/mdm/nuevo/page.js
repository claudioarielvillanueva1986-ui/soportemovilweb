'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

const APK_URL = process.env.NEXT_PUBLIC_MDM_APK_URL || '';
const APK_CHECKSUM = process.env.NEXT_PUBLIC_MDM_APK_CHECKSUM || '';

export default function NuevoDispositivoMdmPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [qrImg, setQrImg] = useState(null);
  const [dispositivoId, setDispositivoId] = useState(null);

  const faltaConfig = !APK_URL || !APK_CHECKSUM;

  async function generar(e) {
    e.preventDefault();
    setError(null);
    setGenerando(true);
    try {
      const { data, error: err } = await supabase.rpc('mdm_generar_alta', {
        p_nombre: nombre.trim() || null,
      });
      if (err) throw new Error(err.message);
      const fila = Array.isArray(data) ? data[0] : data;

      const payload = {
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME':
          'ar.com.soportemovil.mdm/.admin.MdmDeviceAdminReceiver',
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': APK_URL,
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': APK_CHECKSUM,
        'android.app.extra.PROVISIONING_LOCALE': 'es_AR',
        'android.app.extra.PROVISIONING_TIME_ZONE': 'America/Argentina/Buenos_Aires',
        'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
        'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
          api_base_url: window.location.origin,
          enroll_token: fila.enroll_token,
        },
        ...(wifiSsid.trim()
          ? {
              'android.app.extra.PROVISIONING_WIFI_SSID': wifiSsid.trim(),
              'android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE': wifiPassword.trim() ? 'WPA' : 'NONE',
              ...(wifiPassword.trim() ? { 'android.app.extra.PROVISIONING_WIFI_PASSWORD': wifiPassword.trim() } : {}),
            }
          : {}),
      };

      const img = await QRCode.toDataURL(JSON.stringify(payload), { width: 320, margin: 1 });
      setQrImg(img);
      setDispositivoId(fila.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  }

  if (qrImg) {
    return (
      <main>
        <h1 className="panel-h1">QR de alta generado</h1>
        <div className="card" style={{ textAlign: 'center', maxWidth: 420 }}>
          <img src={qrImg} alt="QR de alta MDM" style={{ width: '100%', maxWidth: 320 }} />
          <p className="lbl2" style={{ marginTop: 14 }}>
            En el equipo <strong>nuevo o recién restaurado de fábrica</strong>, en la pantalla de
            bienvenida, tocá 6 veces en cualquier parte de la pantalla y escaneá este QR.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={() => router.push(`/panel/mdm/${dispositivoId}`)}>
              Ver equipo
            </button>
            <button className="btn btn-secondary" onClick={() => router.push('/panel/mdm')}>
              Volver al listado
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1 className="panel-h1">Nuevo equipo (MDM)</h1>

      {faltaConfig && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          Todavía no está configurada la URL del APK ni su checksum (variables de entorno
          <code> NEXT_PUBLIC_MDM_APK_URL</code> / <code>NEXT_PUBLIC_MDM_APK_CHECKSUM</code>). El QR se
          puede generar igual, pero no va a funcionar hasta cargarlas — ver el README del repo
          <code> soportemov-mdm</code>.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={generar} className="card">
        <div className="field">
          <label>Nombre del equipo (para identificarlo en el listado)</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Samsung A54 de Juan Pérez" />
        </div>
        <div className="field">
          <label>Wifi del local (opcional, para que el equipo se conecte solo)</label>
          <input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="Nombre de la red (SSID)" />
        </div>
        <div className="field">
          <input
            type="password"
            value={wifiPassword}
            onChange={(e) => setWifiPassword(e.target.value)}
            placeholder="Contraseña del wifi"
          />
        </div>
        <button className="btn" disabled={generando}>
          {generando ? <span className="spinner" /> : 'Generar QR de alta'}
        </button>
      </form>
    </main>
  );
}
