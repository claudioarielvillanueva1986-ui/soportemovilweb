'use client';

import { useEffect, useState } from 'react';
import { supabase, ESTADOS, formatFecha, formatMoney } from '@/lib/supabase';
import { telWhatsApp } from '@/lib/whatsapp';

const FLOW = [
  ['nuevo', 'Recibido', '📥'],
  ['en_reparacion', 'En proceso', '⚙️'],
  ['listo', 'Listo', '✅'],
  ['entregado', 'Entregado', '📦'],
];

const PASO = {
  nuevo: 0,
  en_revision: 1,
  presupuestado: 1,
  en_reparacion: 1,
  esperando_repuesto: 1,
  listo: 2,
  entregado: 3,
  cancelado: -1,
};

const MENSAJE = {
  nuevo: 'Recibimos tu equipo. Te avisamos cuando empecemos a trabajar.',
  en_revision: 'Estamos revisando tu equipo para diagnosticar la falla.',
  presupuestado: 'Te enviamos el presupuesto. Necesitamos tu aprobación para avanzar.',
  en_reparacion: 'Nuestro técnico está trabajando en tu equipo ahora mismo.',
  esperando_repuesto: 'Estamos esperando un repuesto para poder continuar.',
  listo: '¡Tu equipo está reparado! Podés pasar a retirarlo cuando quieras.',
  entregado: 'Tu equipo fue entregado con éxito. ¡Gracias por elegirnos!',
  cancelado: 'Esta orden fue cancelada.',
};

function BadgeEstado({ estado }) {
  const info = ESTADOS[estado] || { label: estado, color: '#64748b' };
  return (
    <span className="badge" style={{ background: `${info.color}22`, color: info.color, border: `1px solid ${info.color}55` }}>
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
    const { error: err } = await supabase.rpc('responder_presupuesto', { p_numero: numero, p_email: email, p_acepta: acepta });
    setRespondiendo(false);
    if (err) return setError(err.message);
    const { data } = await supabase.rpc('consultar_ticket', { p_numero: numero, p_email: email });
    setTicket(data);
  }

  async function buscar(e) {
    e.preventDefault();
    setError(null);
    setNoEncontrado(false);
    setTicket(null);
    setBuscando(true);
    const { data, error: err } = await supabase.rpc('consultar_ticket', { p_numero: numero, p_email: email });
    setBuscando(false);
    if (err) return setError('Error al consultar. Probá de nuevo en unos segundos.');
    if (!data) return setNoEncontrado(true);
    setTicket(data);
  }

  const paso = ticket ? PASO[ticket.estado] ?? 0 : 0;
  const info = ticket ? ESTADOS[ticket.estado] || { label: ticket.estado, color: '#64748b' } : null;
  const cancelado = ticket?.estado === 'cancelado';

  return (
    <main>
      <div className="hero">
        <h1>Seguí tu <em>reparación</em></h1>
        <p>Ingresá el número de orden y el email con el que la creaste.</p>
      </div>

      <div className="card">
        <form onSubmit={buscar}>
          <div className="grid-2">
            <div className="field">
              <label>Número de orden</label>
              <input required value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="SM-A1B2C3" />
            </div>
            <div className="field">
              <label>Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@email.com" />
            </div>
          </div>
          <button className="btn" disabled={buscando}>
            {buscando ? <span className="spinner" /> : 'Buscar mi orden'}
          </button>
        </form>

        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
        {noEncontrado && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            No encontramos ninguna orden con ese número y email. Revisá los datos e intentá de nuevo.
          </div>
        )}
      </div>

      {ticket && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="seg-num">{ticket.numero}</div>
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '.85rem', marginTop: 4 }}>
            Seguimiento de reparación
          </p>

          <dl className="detalle-grid" style={{ marginTop: 16 }}>
            <div><dt>Cliente</dt><dd>{ticket.nombre}</dd></div>
            <div><dt>Equipo</dt><dd>{ticket.dispositivo}{ticket.marca_modelo ? ` — ${ticket.marca_modelo}` : ''}</dd></div>
            <div><dt>Ingresado</dt><dd>{formatFecha(ticket.creado)}</dd></div>
          </dl>

          {/* Estado actual */}
          <div className="estado-big">
            <span className="estado-badge2" style={{ color: info.color, borderColor: `${info.color}88`, background: `${info.color}18` }}>
              {FLOW.find(([k]) => k === ticket.estado)?.[2] || (cancelado ? '🚫' : '•')} {info.label}
            </span>
            <p className="estado-msg2">{MENSAJE[ticket.estado] || ''}</p>
          </div>

          {/* Barra de progreso */}
          {!cancelado && (
            <div style={{ padding: '4px 4px 8px' }}>
              <div className="flow">
                {FLOW.map(([k, , ], i) => (
                  <span key={k} style={{ display: 'contents' }}>
                    <span className={`flow-dot ${i < paso ? 'done' : i === paso ? 'current' : ''}`}>
                      {i < paso ? '✓' : i === paso ? '●' : '○'}
                    </span>
                    {i < FLOW.length - 1 && <span className={`flow-line ${i < paso ? 'done' : ''}`} />}
                  </span>
                ))}
              </div>
              <div className="flow-labels">
                {FLOW.map(([k, label], i) => (
                  <span key={k} className={`flow-label ${i <= paso ? 'on' : ''}`}>{label}</span>
                ))}
              </div>
            </div>
          )}

          {/* Presupuesto para aprobar */}
          {ticket.estado === 'presupuestado' && ticket.presupuesto != null && (
            <div style={{ border: '1px solid var(--warn)', borderRadius: 10, padding: '14px 16px', margin: '16px 0 4px' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                Presupuesto de la reparación: {formatMoney(ticket.presupuesto)}
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginBottom: 12 }}>
                Necesitamos tu aprobación para avanzar con el arreglo.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-sm" disabled={respondiendo} onClick={() => responder(true)}>Aprobar presupuesto</button>
                <button className="btn btn-danger btn-sm" disabled={respondiendo} onClick={() => responder(false)}>Rechazar</button>
              </div>
            </div>
          )}

          {/* Saldo a abonar al retirar */}
          {ticket.estado === 'listo' && ticket.presupuesto != null && Number(ticket.presupuesto) > 0 && (
            <div className="saldo-pub">
              <div className="lbl">A abonar al retirar</div>
              <div className="val">{formatMoney(ticket.presupuesto)}</div>
            </div>
          )}

          {/* Avisar al taller por WhatsApp cuando está listo */}
          {ticket.estado === 'listo' && telWhatsApp(ticket.taller?.whatsapp) && (
            <a
              className="btn"
              style={{ width: '100%', marginTop: 14, background: '#25D366', borderColor: '#25D366', color: '#fff' }}
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${telWhatsApp(ticket.taller.whatsapp)}?text=${encodeURIComponent(
                `¡Hola! Voy a pasar a buscar mi equipo (orden ${ticket.numero} — ${ticket.nombre}). ¿Están disponibles?`
              )}`}
            >
              Avisar que voy a buscar el equipo
            </a>
          )}

          {/* Problema reportado */}
          <div style={{ marginTop: 16 }}>
            <dt style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Problema reportado
            </dt>
            <p style={{ marginTop: 4 }}>{ticket.descripcion}</p>
          </div>

          {/* Historial */}
          {ticket.actualizaciones?.length > 0 && (
            <>
              <h2 style={{ marginTop: 24, fontSize: '1.05rem' }}>Historial de actualizaciones</h2>
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

          {/* Contacto del taller */}
          {ticket.taller && (ticket.taller.direccion || ticket.taller.horario || ticket.taller.whatsapp) && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontWeight: 700 }}>{ticket.taller.nombre}</div>
              {ticket.taller.direccion && <div className="meta" style={{ marginTop: 4 }}>📍 {ticket.taller.direccion}</div>}
              {ticket.taller.horario && <div className="meta">🕐 {ticket.taller.horario}</div>}
              {telWhatsApp(ticket.taller.whatsapp) && (
                <div className="meta">
                  📱{' '}
                  <a href={`https://wa.me/${telWhatsApp(ticket.taller.whatsapp)}`} target="_blank" rel="noreferrer">
                    Escribinos por WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
