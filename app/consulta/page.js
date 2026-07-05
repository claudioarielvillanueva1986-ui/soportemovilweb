'use client';

import { useEffect, useState } from 'react';
import { supabase, ESTADOS, formatFecha, formatMoney } from '@/lib/supabase';

function BadgeEstado({ estado }) {
  const info = ESTADOS[estado] || { label: estado, color: '#64748b' };
  return (
    <span
      className="badge"
      style={{ background: `${info.color}22`, color: info.color, border: `1px solid ${info.color}55` }}
    >
      {info.label}
    </span>
  );
}

export default function ConsultaPage() {
  const [numero, setNumero] = useState('');
  const [email, setEmail] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState(null);
  const [respondiendo, setRespondiendo] = useState(false);

  useEffect(() => {
    const o = new URLSearchParams(window.location.search).get('orden');
    if (o) setNumero(o);
  }, []);

  async function responder(acepta) {
    if (!confirm(acepta ? '¿Confirmás que aprobás el presupuesto?' : '¿Confirmás que rechazás el presupuesto?')) return;
    setRespondiendo(true);
    const { error: err } = await supabase.rpc('responder_presupuesto', {
      p_numero: numero,
      p_email: email,
      p_acepta: acepta,
    });
    setRespondiendo(false);
    if (err) {
      setError(err.message);
      return;
    }
    const { data } = await supabase.rpc('consultar_ticket', {
      p_numero: numero,
      p_email: email,
    });
    setTicket(data);
  }

  async function buscar(e) {
    e.preventDefault();
    setError(null);
    setNoEncontrado(false);
    setTicket(null);
    setBuscando(true);
    const { data, error: err } = await supabase.rpc('consultar_ticket', {
      p_numero: numero,
      p_email: email,
    });
    setBuscando(false);
    if (err) {
      setError('Error al consultar. Probá de nuevo en unos segundos.');
      return;
    }
    if (!data) {
      setNoEncontrado(true);
      return;
    }
    setTicket(data);
  }

  return (
    <main>
      <div className="hero">
        <h1>
          Consultá tu <em>ticket</em>
        </h1>
        <p>Ingresá el número de ticket y el email con el que lo creaste.</p>
      </div>

      <div className="card">
        <form onSubmit={buscar}>
          <div className="grid-2">
            <div className="field">
              <label>Número de ticket</label>
              <input
                required
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="SM-A1B2C3"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@email.com"
              />
            </div>
          </div>
          <button className="btn" disabled={buscando}>
            {buscando ? <span className="spinner" /> : 'Buscar ticket'}
          </button>
        </form>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
        {noEncontrado && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            No encontramos ningún ticket con ese número y email. Revisá los
            datos e intentá de nuevo.
          </div>
        )}
      </div>

      {ticket && (
        <div className="card" style={{ marginTop: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span className="ticket-numero" style={{ fontSize: '1.2rem' }}>
              {ticket.numero}
            </span>
            <BadgeEstado estado={ticket.estado} />
          </div>

          {ticket.estado === 'presupuestado' && ticket.presupuesto != null && (
            <div
              style={{
                border: '1px solid var(--warn)',
                borderRadius: 8,
                padding: '14px 16px',
                margin: '16px 0 4px',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                Presupuesto de la reparación: {formatMoney(ticket.presupuesto)}
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginBottom: 12 }}>
                Necesitamos tu aprobación para avanzar con el arreglo.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-sm"
                  disabled={respondiendo}
                  onClick={() => responder(true)}
                >
                  Aprobar presupuesto
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={respondiendo}
                  onClick={() => responder(false)}
                >
                  Rechazar
                </button>
              </div>
            </div>
          )}

          <dl className="detalle-grid">
            <div>
              <dt>Cliente</dt>
              <dd>{ticket.nombre}</dd>
            </div>
            <div>
              <dt>Equipo</dt>
              <dd>
                {ticket.dispositivo}
                {ticket.marca_modelo ? ` — ${ticket.marca_modelo}` : ''}
              </dd>
            </div>
            <div>
              <dt>Ingresado</dt>
              <dd>{formatFecha(ticket.creado)}</dd>
            </div>
            <div>
              <dt>Última actualización</dt>
              <dd>{formatFecha(ticket.actualizado)}</dd>
            </div>
          </dl>

          <div>
            <dt
              style={{
                color: 'var(--text-dim)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Problema reportado
            </dt>
            <p style={{ marginTop: 4 }}>{ticket.descripcion}</p>
          </div>

          {ticket.actualizaciones?.length > 0 && (
            <>
              <h2 style={{ marginTop: 24, fontSize: '1.05rem' }}>
                Historial
              </h2>
              <div className="timeline">
                {ticket.actualizaciones.map((a, i) => (
                  <div className="timeline-item" key={i}>
                    <div className="fecha">{formatFecha(a.fecha)}</div>
                    <div>{a.mensaje}</div>
                    {a.estado && <BadgeEstado estado={a.estado} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
