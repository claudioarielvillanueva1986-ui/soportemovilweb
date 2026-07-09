'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

const ESTADOS_MDM = {
  pendiente: { label: 'Pendiente de alta', color: '#94a3b8' },
  activo: { label: 'Activo', color: '#22c55e' },
  bloqueado: { label: 'Bloqueado', color: '#ef4444' },
  baja: { label: 'De baja', color: '#64748b' },
};

export default function DispositivoMdmPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dispositivo, setDispositivo] = useState(null);
  const [comandos, setComandos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [nuevoPaquete, setNuevoPaquete] = useState('');
  const [guardandoApps, setGuardandoApps] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('mdm_dispositivos')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (err || !data) {
      setError('No se encontró el equipo.');
      return;
    }
    setDispositivo(data);
    const { data: com } = await supabase
      .from('mdm_comandos')
      .select('id, tipo, motivo, estado, error_mensaje, created_at, confirmado_en')
      .eq('dispositivo_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    setComandos(com || []);
    const { data: ubi } = await supabase
      .from('mdm_ubicaciones')
      .select('id, lat, lng, precision_m, created_at')
      .eq('dispositivo_id', id)
      .order('created_at', { ascending: false })
      .limit(10);
    setUbicaciones(ubi || []);
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function enviarComando(tipo) {
    setEnviando(true);
    setAviso(null);
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const token = sesion?.session?.access_token || '';
      const res = await fetch('/api/mdm/enviar-comando', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dispositivo_id: id, tipo, motivo: motivo.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el comando');
      setAviso({
        tipo: 'ok',
        texto: data.push?.enviado
          ? 'Comando enviado — el equipo debería reaccionar en segundos.'
          : 'Comando encolado — el equipo lo va a tomar en el próximo check-in (hasta 15 min) si no tiene conexión ahora.',
      });
      setMotivo('');
      cargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  async function agregarApp(e) {
    e.preventDefault();
    const paquete = nuevoPaquete.trim();
    if (!paquete || dispositivo.apps_protegidas?.includes(paquete)) return;
    setGuardandoApps(true);
    const nuevaLista = [...(dispositivo.apps_protegidas || []), paquete];
    const { error: err } = await supabase.from('mdm_dispositivos').update({ apps_protegidas: nuevaLista }).eq('id', id);
    setGuardandoApps(false);
    if (err) return setAviso({ tipo: 'error', texto: err.message });
    setNuevoPaquete('');
    setDispositivo({ ...dispositivo, apps_protegidas: nuevaLista });
  }

  async function quitarApp(paquete) {
    setGuardandoApps(true);
    const nuevaLista = (dispositivo.apps_protegidas || []).filter((p) => p !== paquete);
    const { error: err } = await supabase.from('mdm_dispositivos').update({ apps_protegidas: nuevaLista }).eq('id', id);
    setGuardandoApps(false);
    if (err) return setAviso({ tipo: 'error', texto: err.message });
    setDispositivo({ ...dispositivo, apps_protegidas: nuevaLista });
  }

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!dispositivo) return <PantallaCarga />;

  const info = ESTADOS_MDM[dispositivo.estado] || ESTADOS_MDM.pendiente;

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 18px', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.5rem' }}>
          {dispositivo.nombre || `${dispositivo.marca || ''} ${dispositivo.modelo || ''}`.trim() || 'Equipo'}
        </h1>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/panel/mdm')}>
          ← Volver
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, borderTop: `4px solid ${info.color}` }}>
        <dl className="detalle-grid">
          <div>
            <dt>Estado</dt>
            <dd style={{ color: info.color, fontWeight: 700 }}>{info.label}</dd>
          </div>
          <div>
            <dt>Marca / modelo</dt>
            <dd>{dispositivo.marca || '—'} {dispositivo.modelo || ''}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{formatFecha(dispositivo.created_at)}</dd>
          </div>
          <div>
            <dt>Última conexión</dt>
            <dd>{dispositivo.ultima_conexion ? formatFecha(dispositivo.ultima_conexion) : 'Todavía no se conectó'}</dd>
          </div>
          {dispositivo.motivo_bloqueo && (
            <div>
              <dt>Motivo del bloqueo</dt>
              <dd>{dispositivo.motivo_bloqueo}</dd>
            </div>
          )}
        </dl>
      </div>

      {dispositivo.estado === 'pendiente' ? (
        <div className="alert" style={{ marginBottom: 16 }}>
          Este equipo todavía no completó el alta — escaneá el QR generado en el equipo para
          activarlo.
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Acciones</h2>
          <div className="field">
            <label>Motivo (se le muestra al cliente en la pantalla de bloqueo)</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Cuota de noviembre vencida. Comunicate al 11-xxxx-xxxx"
            />
          </div>
          {aviso && (
            <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`} style={{ marginBottom: 10 }}>
              {aviso.texto}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-danger"
              disabled={enviando || dispositivo.estado === 'bloqueado'}
              onClick={() => enviarComando('bloquear')}
            >
              🔒 Bloquear
            </button>
            <button
              className="btn btn-success"
              disabled={enviando || dispositivo.estado === 'activo'}
              onClick={() => enviarComando('desbloquear')}
            >
              🔓 Desbloquear
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Ubicación</h2>
        {dispositivo.ultima_lat != null && dispositivo.ultima_lng != null ? (
          <>
            <p className="lbl2">
              Última vez: {formatFecha(dispositivo.ultima_ubicacion_en)} ({dispositivo.ultima_lat.toFixed(5)}, {dispositivo.ultima_lng.toFixed(5)})
            </p>
            <a
              className="btn btn-secondary btn-sm"
              href={`https://www.google.com/maps?q=${dispositivo.ultima_lat},${dispositivo.ultima_lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en Google Maps
            </a>
            {ubicaciones.length > 1 && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Historial reciente ({ubicaciones.length})
                </summary>
                <div className="timeline" style={{ marginTop: 10 }}>
                  {ubicaciones.map((u) => (
                    <div className="timeline-item" key={u.id}>
                      <div className="fecha">{formatFecha(u.created_at)}</div>
                      <a
                        href={`https://www.google.com/maps?q=${u.lat},${u.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {u.lat.toFixed(5)}, {u.lng.toFixed(5)}
                      </a>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <p className="lbl2">Todavía no se recibió ninguna ubicación (llega en el próximo check-in del equipo, hasta 15 min).</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Apps protegidas</h2>
        <p className="lbl2" style={{ marginBottom: 12 }}>
          El cliente no va a poder desinstalar estas apps del equipo. El resto del equipo funciona
          normal. Se aplica en el próximo check-in (hasta 15 min).
        </p>
        <form onSubmit={agregarApp} className="grid-2" style={{ alignItems: 'end', marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Nombre de paquete de la app</label>
            <input
              value={nuevoPaquete}
              onChange={(e) => setNuevoPaquete(e.target.value)}
              placeholder="Ej: com.whatsapp"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <button className="btn btn-secondary" style={{ width: '100%' }} disabled={guardandoApps || !nuevoPaquete.trim()}>
              + Agregar
            </button>
          </div>
        </form>
        {(dispositivo.apps_protegidas || []).length === 0 ? (
          <p className="lbl2">No hay apps protegidas en este equipo.</p>
        ) : (
          (dispositivo.apps_protegidas || []).map((paquete) => (
            <div className="ticket-row" key={paquete}>
              <div className="info">
                <div className="titulo" style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{paquete}</div>
              </div>
              <button className="chip" style={{ color: '#ef4444' }} disabled={guardandoApps} onClick={() => quitarApp(paquete)}>
                Quitar
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Historial de comandos</h2>
        {comandos.length === 0 ? (
          <p className="lbl2">Todavía no se mandó ningún comando.</p>
        ) : (
          <div className="timeline">
            {comandos.map((c) => (
              <div className="timeline-item" key={c.id}>
                <div className="fecha">{formatFecha(c.created_at)}</div>
                <div>
                  {c.tipo === 'bloquear' ? '🔒 Bloquear' : '🔓 Desbloquear'}
                  {c.motivo ? ` — ${c.motivo}` : ''}
                </div>
                <span className="badge">
                  {c.estado}
                  {c.error_mensaje ? `: ${c.error_mensaje}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
