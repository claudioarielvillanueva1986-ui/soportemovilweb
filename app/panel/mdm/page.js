'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatFecha } from '@/lib/supabase';

const ESTADOS_MDM = {
  pendiente: { label: 'Pendiente de alta', color: '#94a3b8' },
  activo: { label: 'Activo', color: '#22c55e' },
  bloqueado: { label: 'Bloqueado', color: '#ef4444' },
  baja: { label: 'De baja', color: '#64748b' },
};

export default function MdmPage() {
  const [dispositivos, setDispositivos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data } = await supabase
      .from('mdm_dispositivos')
      .select('id, nombre, marca, modelo, estado, ultima_conexion, created_at')
      .order('created_at', { ascending: false });
    setDispositivos(data || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 18px', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.5rem' }}>MDM — equipos vendidos</h1>
        <a className="btn btn-sm" href="/panel/mdm/nuevo">
          + Nuevo equipo
        </a>
      </div>
      <p className="lbl2" style={{ marginBottom: 16 }}>
        Equipos Android vendidos con gestión propia: alta por QR al entregarlos, bloqueo/desbloqueo remoto.
      </p>

      {cargando ? (
        <p style={{ color: 'var(--text-dim)' }}>Cargando…</p>
      ) : dispositivos.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>Todavía no diste de alta ningún equipo.</p>
      ) : (
        dispositivos.map((d) => {
          const info = ESTADOS_MDM[d.estado] || ESTADOS_MDM.pendiente;
          return (
            <a
              className="ticket-row"
              key={d.id}
              href={`/panel/mdm/${d.id}`}
              style={{ display: 'flex', textDecoration: 'none', color: 'inherit' }}
            >
              <div className="info">
                <div className="titulo">{d.nombre || `${d.marca || ''} ${d.modelo || ''}`.trim() || 'Equipo sin nombre'}</div>
                <div className="meta">
                  Alta: {formatFecha(d.created_at)}
                  {d.ultima_conexion ? ` · Última conexión: ${formatFecha(d.ultima_conexion)}` : ' · Todavía no se conectó'}
                </div>
              </div>
              <span
                className="badge"
                style={{ color: info.color, border: `1px solid ${info.color}55` }}
              >
                {info.label}
              </span>
            </a>
          );
        })
      )}
    </main>
  );
}
