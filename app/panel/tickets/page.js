'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  supabase,
  ESTADOS,
  PRIORIDADES,
  METODOS_PAGO,
  formatFecha,
  formatMoney,
} from '@/lib/supabase';
import { linkAvisoWhatsApp } from '@/lib/whatsapp';

function RepuestosTicket({ ticketId }) {
  const [items, setItems] = useState([]);
  const [productos, setProductos] = useState([]);
  const [prodId, setProdId] = useState('');
  const [cant, setCant] = useState(1);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('ticket_repuestos')
      .select('*, productos(nombre)')
      .eq('ticket_id', ticketId)
      .order('created_at');
    setItems(data || []);
  }, [ticketId]);

  useEffect(() => {
    cargar();
    supabase
      .from('productos')
      .select('id, nombre, stock, maneja_stock')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setProductos(data || []));
  }, [cargar]);

  async function agregar(e) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.rpc('usar_repuesto', {
      p_ticket_id: ticketId,
      p_producto_id: prodId,
      p_cantidad: Number(cant),
    });
    if (err) return setError(err.message);
    setProdId('');
    setCant(1);
    cargar();
  }

  async function quitar(id) {
    const { error: err } = await supabase.rpc('quitar_repuesto', { p_id: id });
    if (err) setError(err.message);
    else cargar();
  }

  const total = items.reduce((s, i) => s + Number(i.precio_unitario) * i.cantidad, 0);

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: '1rem' }}>
        Repuestos usados{' '}
        {total > 0 && (
          <span style={{ color: 'var(--accent)' }}>— {formatMoney(total)}</span>
        )}
      </h2>
      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {items.map((i) => (
        <div className="carrito-item" key={i.id}>
          <div className="info">
            <div>
              {i.cantidad} × {i.productos?.nombre || 'Producto'}
            </div>
            <div className="meta">{formatMoney(i.precio_unitario)} c/u — descuenta stock</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="subtotal">{formatMoney(Number(i.precio_unitario) * i.cantidad)}</div>
            <button className="chip" style={{ color: '#ef4444' }} onClick={() => quitar(i.id)}>
              Quitar
            </button>
          </div>
        </div>
      ))}
      <form onSubmit={agregar} style={{ marginTop: 10 }}>
        <div className="grid-2">
          <div className="field">
            <label>Repuesto / producto</label>
            <select required value={prodId} onChange={(e) => setProdId(e.target.value)}>
              <option value="">— Elegir —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.maneja_stock ? ` (stock ${p.stock})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input
              type="number"
              min="1"
              value={cant}
              onChange={(e) => setCant(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-secondary btn-sm">Usar repuesto</button>
      </form>
    </div>
  );
}

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
  const [presupuesto, setPresupuesto] = useState(ticket.presupuesto ?? '');
  const [negocioNombre, setNegocioNombre] = useState('');
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
    supabase
      .from('negocios')
      .select('nombre')
      .maybeSingle()
      .then(({ data }) => setNegocioNombre(data?.nombre || ''));
  }, [ticket.id]);

  const waLink = linkAvisoWhatsApp({
    ticket: { ...ticket, estado, presupuesto: presupuesto === '' ? null : Number(presupuesto) },
    negocio: negocioNombre,
    host: typeof window !== 'undefined' ? window.location.host : '',
  });

  async function guardar() {
    setGuardando(true);
    setAviso(null);

    const { error: errUpd } = await supabase
      .from('tickets')
      .update({
        estado,
        prioridad,
        notas_internas: notas,
        presupuesto: presupuesto === '' ? null : Number(presupuesto),
      })
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {waLink && (
            <a className="btn btn-sm" href={waLink} target="_blank" rel="noreferrer">
              Avisar por WhatsApp
            </a>
          )}
          <a
            className="btn btn-secondary btn-sm"
            href={`/panel/imprimir/${ticket.id}`}
          >
            Comprobante
          </a>
          <a
            className="btn btn-secondary btn-sm"
            href={`/panel/etiqueta/${ticket.id}`}
          >
            Etiqueta
          </a>
          <button className="btn btn-secondary btn-sm" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
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
        {ticket.equipo_password && (
          <div>
            <dt>Clave / patrón del equipo</dt>
            <dd style={{ fontFamily: 'var(--mono)' }}>{ticket.equipo_password}</dd>
          </div>
        )}
        {ticket.v1_id && (
          <div>
            <dt>Origen</dt>
            <dd>Migrada del sistema anterior (#{ticket.v1_id})</dd>
          </div>
        )}
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
        <div className="field">
          <label>Presupuesto ($) — con estado "Presupuesto enviado" el cliente puede aprobarlo online</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
          />
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

      <RepuestosTicket ticketId={ticket.id} />

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

  const [limite, setLimite] = useState(100);
  const [totalServer, setTotalServer] = useState(0);
  const [stats, setStats] = useState({ total: 0, abiertos: 0, nuevo: 0, en_reparacion: 0, listo: 0 });
  const timerRef = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    let q = supabase
      .from('tickets')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, limite - 1);
    if (filtro === 'abiertos') q = q.not('estado', 'in', '(entregado,cancelado)');
    else if (filtro !== 'todos') q = q.eq('estado', filtro);
    if (busqueda.trim()) {
      const t = busqueda.trim().replace(/[%,()]/g, '');
      q = q.or(
        `numero.ilike.%${t}%,nombre.ilike.%${t}%,email.ilike.%${t}%,telefono.ilike.%${t}%,marca_modelo.ilike.%${t}%`
      );
    }
    const { data, count } = await q;
    setTickets(data || []);
    setTotalServer(count || 0);
    setCargando(false);
  }, [filtro, busqueda, limite]);

  const cargarStats = useCallback(async () => {
    const contar = (mod) => {
      let q = supabase.from('tickets').select('id', { count: 'exact', head: true });
      return mod(q).then(({ count }) => count || 0);
    };
    const [total, abiertos, nuevo, en_reparacion, listo] = await Promise.all([
      contar((q) => q),
      contar((q) => q.not('estado', 'in', '(entregado,cancelado)')),
      contar((q) => q.eq('estado', 'nuevo')),
      contar((q) => q.eq('estado', 'en_reparacion')),
      contar((q) => q.eq('estado', 'listo')),
    ]);
    setStats({ total, abiertos, nuevo, en_reparacion, listo });
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(cargar, busqueda ? 300 : 0);
    return () => clearTimeout(timerRef.current);
  }, [cargar, busqueda]);

  useEffect(() => {
    cargarStats();
    const q = new URLSearchParams(window.location.search).get('buscar');
    if (q) {
      setBusqueda(q);
      setFiltro('todos');
    }
  }, [cargarStats]);

  const visibles = tickets;

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
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-sm" href="/panel/tickets/nueva">
            + Nueva orden
          </a>
          <button className="btn btn-secondary btn-sm" onClick={cargar}>
            Actualizar
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="num">{stats.total}</div>
          <div className="lbl">Total</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: 'var(--accent)' }}>
            {stats.abiertos}
          </div>
          <div className="lbl">Abiertos</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#3b82f6' }}>
            {stats.nuevo}
          </div>
          <div className="lbl">Nuevos</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#f59e0b' }}>
            {stats.en_reparacion}
          </div>
          <div className="lbl">En reparación</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#22c55e' }}>
            {stats.listo}
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
            onClick={() => {
              setFiltro(k);
              setLimite(100);
            }}
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

      {tickets.length < totalServer && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={() => setLimite(limite + 100)}>
            Cargar más ({totalServer - tickets.length} restantes)
          </button>
        </div>
      )}
    </main>
  );
}
