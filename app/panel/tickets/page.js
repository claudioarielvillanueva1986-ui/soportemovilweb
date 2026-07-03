'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  supabase,
  ESTADOS,
  PRIORIDADES,
  METODOS_PAGO,
  formatFecha,
  formatMoney,
} from '@/lib/supabase';

function PagosTicket({ ticketId }) {
  const [pagos, setPagos] = useState([]);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [tipo, setTipo] = useState('sena');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('ticket_pagos')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    setPagos(data || []);
  }, [ticketId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function agregar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.from('ticket_pagos').insert({
      ticket_id: ticketId,
      tipo,
      metodo,
      monto: Number(monto),
      registrado_por: (await supabase.auth.getUser()).data.user?.id,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setMonto('');
    cargar();
  }

  const total = pagos.reduce((s, p) => s + Number(p.monto), 0);

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: '1rem' }}>
        Señas y pagos{' '}
        {total > 0 && (
          <span style={{ color: 'var(--accent)' }}>
            — abonado {formatMoney(total)}
          </span>
        )}
      </h2>
      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {pagos.map((p) => (
        <div className="carrito-item" key={p.id}>
          <div className="info">
            <div>
              {p.tipo === 'sena' ? 'Seña' : 'Pago'} · {METODOS_PAGO[p.metodo]}
            </div>
            <div className="meta">{formatFecha(p.created_at)}</div>
          </div>
          <div className="subtotal">{formatMoney(p.monto)}</div>
        </div>
      ))}
      <form onSubmit={agregar} style={{ marginTop: 10 }}>
        <div className="grid-2">
          <div className="field">
            <label>Monto ($)</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="sena">Seña</option>
              <option value="pago">Pago</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Método</label>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {Object.entries(METODOS_PAGO)
              .filter(([k]) => !k.startsWith('mercadopago'))
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={ocupado}>
          Registrar {tipo === 'sena' ? 'seña' : 'pago'}
        </button>
      </form>
    </div>
  );
}

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

function DetalleTicket({ ticket, onCerrar, onGuardado }) {
  const [estado, setEstado] = useState(ticket.estado);
  const [prioridad, setPrioridad] = useState(ticket.prioridad);
  const [notas, setNotas] = useState(ticket.notas_internas || '');
  const [mensaje, setMensaje] = useState('');
  const [actualizaciones, setActualizaciones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    supabase
      .from('ticket_actualizaciones')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setActualizaciones(data || []));
  }, [ticket.id]);

  async function guardar() {
    setGuardando(true);
    setAviso(null);

    const { error: errUpd } = await supabase
      .from('tickets')
      .update({ estado, prioridad, notas_internas: notas })
      .eq('id', ticket.id);

    let errMsg = errUpd?.message;

    if (!errMsg && mensaje.trim()) {
      const { error: errMsj } = await supabase
        .from('ticket_actualizaciones')
        .insert({
          ticket_id: ticket.id,
          mensaje: mensaje.trim(),
          estado: estado !== ticket.estado ? estado : null,
          publico: true,
        });
      errMsg = errMsj?.message;
    }

    setGuardando(false);
    if (errMsg) {
      setAviso({ tipo: 'error', texto: errMsg });
      return;
    }
    setAviso({ tipo: 'ok', texto: 'Cambios guardados.' });
    setMensaje('');
    onGuardado();
    const { data } = await supabase
      .from('ticket_actualizaciones')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false });
    setActualizaciones(data || []);
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <span className="ticket-numero" style={{ fontSize: '1.15rem' }}>
          {ticket.numero}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={onCerrar}>
          Cerrar
        </button>
      </div>

      <dl className="detalle-grid">
        <div>
          <dt>Cliente</dt>
          <dd>{ticket.nombre}</dd>
        </div>
        <div>
          <dt>Contacto</dt>
          <dd>
            {ticket.email}
            {ticket.telefono ? ` · ${ticket.telefono}` : ''}
          </dd>
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
          <dd>{formatFecha(ticket.created_at)}</dd>
        </div>
      </dl>

      <p
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: '0.92rem',
        }}
      >
        {ticket.descripcion}
      </p>

      {aviso && (
        <div
          className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}
          style={{ marginTop: 14 }}
        >
          {aviso.texto}
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="field">
          <label>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {Object.entries(ESTADOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Prioridad</label>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
          >
            {Object.entries(PRIORIDADES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Notas internas (no las ve el cliente)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          style={{ minHeight: 70 }}
        />
      </div>

      <div className="field">
        <label>Nueva actualización pública (la ve el cliente al consultar)</label>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          style={{ minHeight: 70 }}
          placeholder="Ej: Presupuesto enviado por email, esperamos tu confirmación."
        />
      </div>

      <button className="btn" onClick={guardar} disabled={guardando}>
        {guardando ? <span className="spinner" /> : 'Guardar cambios'}
      </button>

      <PagosTicket ticketId={ticket.id} />

      {actualizaciones.length > 0 && (
        <>
          <h2 style={{ marginTop: 24, fontSize: '1rem' }}>Historial</h2>
          <div className="timeline">
            {actualizaciones.map((a) => (
              <div className="timeline-item" key={a.id}>
                <div className="fecha">{formatFecha(a.created_at)}</div>
                <div>{a.mensaje}</div>
                {a.estado && <BadgeEstado estado={a.estado} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('abiertos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = tickets.filter((t) => {
    if (filtro === 'abiertos' && ['entregado', 'cancelado'].includes(t.estado))
      return false;
    if (filtro !== 'todos' && filtro !== 'abiertos' && t.estado !== filtro)
      return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        t.numero.toLowerCase().includes(q) ||
        t.nombre.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.marca_modelo || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const contar = (estado) => tickets.filter((t) => t.estado === estado).length;
  const abiertos = tickets.filter(
    (t) => !['entregado', 'cancelado'].includes(t.estado)
  ).length;

  return (
    <main>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '6px 0 22px',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Reparaciones</h1>
        <button className="btn btn-secondary btn-sm" onClick={cargar}>
          Actualizar
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="num">{tickets.length}</div>
          <div className="lbl">Total</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: 'var(--accent)' }}>
            {abiertos}
          </div>
          <div className="lbl">Abiertos</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#3b82f6' }}>
            {contar('nuevo')}
          </div>
          <div className="lbl">Nuevos</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#f59e0b' }}>
            {contar('en_reparacion')}
          </div>
          <div className="lbl">En reparación</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#22c55e' }}>
            {contar('listo')}
          </div>
          <div className="lbl">Listos</div>
        </div>
      </div>

      {seleccionado && (
        <DetalleTicket
          ticket={seleccionado}
          onCerrar={() => setSeleccionado(null)}
          onGuardado={cargar}
        />
      )}

      <div className="field">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, nombre, email o equipo..."
        />
      </div>

      <div className="filters">
        {[
          ['abiertos', 'Abiertos'],
          ['todos', 'Todos'],
          ...Object.entries(ESTADOS).map(([k, v]) => [k, v.label]),
        ].map(([k, label]) => (
          <button
            key={k}
            className={`chip ${filtro === k ? 'active' : ''}`}
            onClick={() => setFiltro(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {cargando ? (
        <p style={{ color: 'var(--text-dim)' }}>Cargando tickets...</p>
      ) : visibles.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>
          No hay tickets que coincidan con el filtro.
        </p>
      ) : (
        visibles.map((t) => (
          <div
            className="ticket-row"
            key={t.id}
            onClick={() => {
              setSeleccionado(t);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="info">
              <div className="numero">
                {t.numero}
                {t.prioridad === 'alta' || t.prioridad === 'urgente' ? (
                  <span style={{ color: '#ef4444', marginLeft: 8 }}>
                    {PRIORIDADES[t.prioridad]}
                  </span>
                ) : null}
              </div>
              <div className="titulo">
                {t.nombre} — {t.dispositivo}
                {t.marca_modelo ? ` (${t.marca_modelo})` : ''}
              </div>
              <div className="meta">{formatFecha(t.created_at)}</div>
            </div>
            <BadgeEstado estado={t.estado} />
          </div>
        ))
      )}
    </main>
  );
}
