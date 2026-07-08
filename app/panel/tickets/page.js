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
import { usePerfil } from '@/lib/panel-context';
import { useCobroReal, ModalCobroReal, METODOS_ELECTRONICOS_ORDEN } from '@/components/cobro-real';

// Etiquetas disponibles para las órdenes (color por etiqueta)
const ETIQUETAS = [
  ['Urgente', '#ef4444'],
  ['Garantía', '#3b82f6'],
  ['Esperando repuesto', '#f59e0b'],
  ['Avisar cliente', '#8b5cf6'],
  ['Presupuestada', '#22c55e'],
];
const COLOR_ETIQUETA = Object.fromEntries(ETIQUETAS);

const AV_COLORES_ORD = ['#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#22c55e', '#8b5cf6', '#14b8a6', '#ef4444'];
function inicialesOrd(nombre) {
  return (nombre || '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
function avColorOrd(nombre) {
  const n = String(nombre || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AV_COLORES_ORD[n % AV_COLORES_ORD.length];
}
// Columnas del kanban: agrupan estados y definen el estado destino al soltar.
const KANBAN_COLS = [
  { key: 'recibido', label: 'Recibido', estados: ['nuevo', 'en_revision'], destino: 'nuevo', color: '#3b82f6' },
  { key: 'proceso', label: 'En proceso', estados: ['presupuestado', 'en_reparacion', 'esperando_repuesto'], destino: 'en_reparacion', color: '#f59e0b' },
  { key: 'listo', label: 'Listo', estados: ['listo'], destino: 'listo', color: '#22c55e' },
  { key: 'entregado', label: 'Entregado', estados: ['entregado'], destino: 'entregado', color: '#10b981' },
];

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function ChipsEtiquetas({ etiquetas }) {
  if (!etiquetas?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {etiquetas.map((tag) => (
        <span
          key={tag}
          className="badge"
          style={{
            background: `${COLOR_ETIQUETA[tag] || '#64748b'}22`,
            color: COLOR_ETIQUETA[tag] || '#64748b',
            border: `1px solid ${COLOR_ETIQUETA[tag] || '#64748b'}55`,
            fontSize: '0.72rem',
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function RepuestosTicket({ ticketId }) {
  const [items, setItems] = useState([]);
  const [productos, setProductos] = useState([]);
  const [prodId, setProdId] = useState('');
  const [cant, setCant] = useState(1);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

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
    if (ocupado) return;
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.rpc('usar_repuesto', {
      p_ticket_id: ticketId,
      p_producto_id: prodId,
      p_cantidad: Number(cant),
    });
    setOcupado(false);
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
        <button className="btn btn-secondary btn-sm" disabled={ocupado || !prodId}>
          {ocupado ? <span className="spinner" /> : 'Usar repuesto'}
        </button>
      </form>
    </div>
  );
}

function idemKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Aviso automático real por WhatsApp (Cloud API) — no bloquea ni interrumpe
// el flujo si falla o si el negocio no tiene la Cloud API conectada.
async function notificarOrden(ticketId, tipo) {
  try {
    const { data: sesion } = await supabase.auth.getSession();
    await fetch('/api/whatsapp/notificar-orden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token || ''}` },
      body: JSON.stringify({ ticket_id: ticketId, tipo }),
    });
  } catch {
    /* best-effort */
  }
}

function PagosTicket({ ticketId, presupuesto, onCambio }) {
  const [pagos, setPagos] = useState([]);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  // cobro de saldo con pago mixto
  const [desglose, setDesglose] = useState(null); // null | [{monto, metodo, mp_payment_id}]
  const [facturaConectada, setFacturaConectada] = useState(false);
  const { cobro, iniciarCobro, cancelarCobro, continuarTrasCobro } = useCobroReal();

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('ticket_pagos')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setPagos(data || []);
  }, [ticketId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    supabase
      .from('facturacion_conexion')
      .select('conectado')
      .maybeSingle()
      .then(({ data }) => setFacturaConectada(!!data?.conectado));
  }, []);

  const abonado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const presu = Number(presupuesto) || 0;
  const saldo = Math.max(0, presu - abonado);

  // registrar una seña suelta (feeds caja + idempotencia)
  async function agregarSena(e) {
    e.preventDefault();
    if (ocupado) return;
    setError(null);
    const montoNum = Number(monto);

    if (facturaConectada && METODOS_ELECTRONICOS_ORDEN.includes(metodo)) {
      iniciarCobro(montoNum, 'Seña de orden', async (mpPaymentId) => {
        setOcupado(true);
        const { error: err } = await supabase.rpc('registrar_pago_orden', {
          p_ticket_id: ticketId,
          p_monto: montoNum,
          p_metodo: metodo,
          p_tipo: 'sena',
          p_mp_payment_id: mpPaymentId,
          p_idempotency_key: idemKey(),
        });
        setOcupado(false);
        if (err) return setError(err.message);
        setMonto('');
        cargar();
        onCambio?.();
      });
      return;
    }

    setOcupado(true);
    const { error: err } = await supabase.rpc('registrar_pago_orden', {
      p_ticket_id: ticketId,
      p_monto: montoNum,
      p_metodo: metodo,
      p_tipo: 'sena',
      p_idempotency_key: idemKey(),
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setMonto('');
    cargar();
    onCambio?.();
  }

  // cobrar saldo y entregar (pago mixto atómico)
  async function cobrarYEntregar() {
    setError(null);

    if (facturaConectada) {
      const pendienteIdx = desglose.findIndex(
        (p) => METODOS_ELECTRONICOS_ORDEN.includes(p.metodo) && Number(p.monto) > 0 && !p.mp_payment_id
      );
      if (pendienteIdx >= 0) {
        const montoLinea = Number(desglose[pendienteIdx].monto);
        iniciarCobro(montoLinea, 'Saldo de orden', (mpPaymentId) => {
          setDesglose((prev) => prev.map((p, j) => (j === pendienteIdx ? { ...p, mp_payment_id: mpPaymentId } : p)));
        });
        return;
      }
    }

    setOcupado(true);
    const pagosLimpios = desglose
      .filter((p) => Number(p.monto) > 0)
      .map((p) => ({ monto: Number(p.monto), metodo: p.metodo, mp_payment_id: p.mp_payment_id || null }));
    if (pagosLimpios.length === 0) {
      setOcupado(false);
      setError('Ingresá al menos un pago.');
      return;
    }
    const { data, error: err } = await supabase.rpc('cobrar_saldo_y_entregar', {
      p_ticket_id: ticketId,
      p_pagos: pagosLimpios,
      p_idempotency_key: idemKey(),
      p_entregar: true,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setDesglose(null);
    cargar();
    onCambio?.();
    if (data?.entregado) {
      setError(null);
    }
  }

  // devolver la seña (equipo no reparado / cliente se lleva el equipo)
  async function devolverSena() {
    if (ocupado) return;
    if (
      !window.confirm(
        `¿Devolver ${formatMoney(abonado)} al cliente? Se registra el egreso en la caja.`
      )
    )
      return;
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.rpc('devolver_sena', {
      p_ticket_id: ticketId,
      p_metodo: metodo,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    cargar();
    onCambio?.();
  }

  const totalCobro = (desglose || []).reduce((s, p) => s + (Number(p.monto) || 0), 0);

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: '1rem' }}>Pagos de la orden</h2>

      {/* Resumen de saldo */}
      {presu > 0 && (
        <div className="saldo-box">
          <div>
            <span className="lbl2">Presupuesto</span>
            <strong>{formatMoney(presu)}</strong>
          </div>
          <div>
            <span className="lbl2">Abonado</span>
            <strong>{formatMoney(abonado)}</strong>
          </div>
          <div>
            <span className="lbl2">Saldo</span>
            <strong style={{ color: saldo > 0 ? 'var(--warn)' : 'var(--accent)' }}>
              {formatMoney(saldo)}
            </strong>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      {pagos.map((p) => (
        <div className="carrito-item" key={p.id}>
          <div className="info">
            <div>
              {Number(p.monto) < 0 ? 'Devolución' : p.tipo === 'sena' ? 'Seña' : 'Pago'} ·{' '}
              {METODOS_PAGO[p.metodo]}
            </div>
            <div className="meta">{formatFecha(p.created_at)}</div>
          </div>
          <div className="subtotal" style={{ color: Number(p.monto) < 0 ? 'var(--error-soft)' : 'inherit' }}>
            {formatMoney(p.monto)}
          </div>
        </div>
      ))}

      {/* Cobrar saldo y entregar */}
      {saldo > 0 && (
        <div style={{ marginTop: 14 }}>
          {desglose === null ? (
            <button
              className="btn"
              onClick={() => setDesglose([{ monto: saldo, metodo: 'efectivo', mp_payment_id: null }])}
            >
              Cobrar saldo y entregar ({formatMoney(saldo)})
            </button>
          ) : (
            <div className="card" style={{ padding: 18 }}>
              <h2 style={{ fontSize: '0.95rem' }}>Cobrar {formatMoney(saldo)}</h2>
              <p className="lbl2" style={{ marginBottom: 10 }}>
                Podés dividir el pago en varios métodos.
              </p>
              {desglose.map((p, i) => (
                <div className="grid-2" key={i} style={{ marginBottom: 8 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={p.monto}
                      onChange={(e) => {
                        const c = [...desglose];
                        c[i] = { ...c[i], monto: e.target.value, mp_payment_id: null };
                        setDesglose(c);
                      }}
                      placeholder="Monto"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, flexDirection: 'row', gap: 6 }}>
                    <select
                      value={p.metodo}
                      onChange={(e) => {
                        const c = [...desglose];
                        c[i] = { ...c[i], metodo: e.target.value, mp_payment_id: null };
                        setDesglose(c);
                      }}
                    >
                      {Object.entries(METODOS_PAGO).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    {desglose.length > 1 && (
                      <button
                        type="button"
                        className="chip"
                        onClick={() => setDesglose(desglose.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="chip"
                style={{ marginBottom: 12 }}
                onClick={() => setDesglose([...desglose, { monto: '', metodo: 'efectivo', mp_payment_id: null }])}
              >
                + Otro método
              </button>
              <div className="carrito-total" style={{ padding: '8px 0' }}>
                <span>Total a cobrar</span>
                <span>{formatMoney(totalCobro)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={cobrarYEntregar} disabled={ocupado}>
                  {ocupado ? <span className="spinner" /> : 'Cobrar y entregar'}
                </button>
                <button className="btn btn-secondary" onClick={() => setDesglose(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {saldo <= 0 && presu > 0 && pagos.length > 0 && (
        <div className="alert alert-ok" style={{ marginTop: 12 }}>
          Orden saldada. {abonado > presu ? '' : 'Lista para entregar.'}
        </div>
      )}

      {/* Registrar una seña suelta (siempre disponible) */}
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Registrar una seña / pago suelto
        </summary>
        <form onSubmit={agregarSena} style={{ marginTop: 10 }}>
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
              <label>Método</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                {Object.entries(METODOS_PAGO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" disabled={ocupado}>
            {ocupado ? <span className="spinner" /> : 'Registrar seña'}
          </button>
        </form>

        {abonado > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <p className="lbl2" style={{ marginBottom: 8 }}>
              Equipo no reparado: devolvé lo abonado ({formatMoney(abonado)}) por el
              método seleccionado arriba.
            </p>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={devolverSena}
              disabled={ocupado}
            >
              {ocupado ? <span className="spinner" /> : 'Devolver seña / abonado'}
            </button>
          </div>
        )}
      </details>

      {!facturaConectada && (metodo !== 'efectivo' && metodo !== 'transferencia') && (
        <p style={{ fontSize: '.78rem', color: 'var(--text-dim)', marginTop: 8 }}>
          Conectá Facturá en Configuración para cobrar de verdad con tarjeta o QR — por ahora este monto se
          registra manualmente.
        </p>
      )}

      <ModalCobroReal cobro={cobro} cancelarCobro={cancelarCobro} continuarTrasCobro={continuarTrasCobro} />
    </div>
  );
}

// Reduce una imagen a máx 1280px y la comprime a JPEG (subidas livianas en móvil)
async function comprimirImagen(file) {
  if (!file.type?.startsWith('image/')) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const MAX = 1280;
    let { width, height } = img;
    if (width > MAX || height > MAX) {
      const r = Math.min(MAX / width, MAX / height);
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    return blob || file;
  } catch {
    return file;
  }
}

// Fotos del equipo al ingreso (evidencia de estado). Cámara en móvil.
function FotosTicket({ ticketId }) {
  const [fotos, setFotos] = useState([]);
  const [negocioId, setNegocioId] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('ticket_fotos')
      .select('id, path, url, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at');
    setFotos(data || []);
  }, [ticketId]);

  useEffect(() => {
    cargar();
    supabase.from('negocios').select('id').maybeSingle().then(({ data }) => setNegocioId(data?.id || null));
  }, [cargar]);

  async function subir(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !negocioId) return;
    setError(null);
    setSubiendo(true);
    for (const file of files) {
      try {
        const blob = await comprimirImagen(file);
        const path = `${negocioId}/${ticketId}/${crypto.randomUUID()}.jpg`;
        const { error: errUp } = await supabase.storage
          .from('ordenes-fotos')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (errUp) throw new Error(errUp.message);
        const url = supabase.storage.from('ordenes-fotos').getPublicUrl(path).data.publicUrl;
        const { error: errRpc } = await supabase.rpc('registrar_foto_ticket', {
          p_ticket_id: ticketId,
          p_path: path,
          p_url: url,
        });
        if (errRpc) throw new Error(errRpc.message);
      } catch (err) {
        setError(err.message);
      }
    }
    setSubiendo(false);
    cargar();
  }

  async function eliminar(foto) {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    const { data: path, error: errRpc } = await supabase.rpc('eliminar_foto_ticket', { p_id: foto.id });
    if (errRpc) return setError(errRpc.message);
    if (path) await supabase.storage.from('ordenes-fotos').remove([path]);
    cargar();
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: '1rem' }}>Fotos del equipo</h2>
      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {fotos.length > 0 && (
        <div className="fotos-grid">
          {fotos.map((f) => (
            <div className="foto-item" key={f.id}>
              <a href={f.url} target="_blank" rel="noreferrer">
                <img src={f.url} alt="Foto del equipo" loading="lazy" />
              </a>
              <button className="foto-del" onClick={() => eliminar(f)} aria-label="Eliminar">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="btn btn-secondary btn-sm" style={{ marginTop: 10, display: 'inline-flex', cursor: 'pointer' }}>
        {subiendo ? <span className="spinner" /> : '+ Agregar fotos'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={subir}
          disabled={subiendo}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
}

// Rentabilidad de la orden (solo dueño): presupuesto − costo repuestos − costo extra
function CostosOrden({ ticketId }) {
  const [m, setM] = useState(null);
  const [costoExtra, setCostoExtra] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('margen_orden', { p_ticket_id: ticketId });
    if (data) {
      setM(data);
      setCostoExtra(data.costo_extra ? String(data.costo_extra) : '');
    }
  }, [ticketId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    setGuardando(true);
    const { data, error } = await supabase.rpc('guardar_costo_extra', {
      p_ticket_id: ticketId,
      p_costo: costoExtra === '' ? 0 : Number(costoExtra),
    });
    setGuardando(false);
    if (!error && data) setM(data);
  }

  if (!m) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: '1rem' }}>Rentabilidad</h2>
        <button className="chip" onClick={cargar}>Actualizar</button>
      </div>
      <div className="saldo-box">
        <div>
          <span className="lbl2">Presupuesto</span>
          <strong>{formatMoney(m.presupuesto)}</strong>
        </div>
        <div>
          <span className="lbl2">Costo total</span>
          <strong>{formatMoney(m.costo_total)}</strong>
        </div>
        <div>
          <span className="lbl2">Margen</span>
          <strong style={{ color: m.margen >= 0 ? 'var(--accent)' : 'var(--error-soft)' }}>
            {formatMoney(m.margen)}
          </strong>
        </div>
      </div>
      <p className="lbl2" style={{ marginTop: 6 }}>
        Repuestos: {formatMoney(m.costo_repuestos)} (del costo de inventario) + costo adicional.
      </p>
      <div className="grid-2" style={{ marginTop: 8 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Costo adicional (mano de obra tercerizada, envíos…)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={costoExtra}
            onChange={(e) => setCostoExtra(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="field" style={{ marginBottom: 0, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={guardar} disabled={guardando}>
            {guardando ? <span className="spinner" /> : 'Guardar costo'}
          </button>
        </div>
      </div>
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
  const { esDueno } = usePerfil();
  const [estado, setEstado] = useState(ticket.estado);
  const [prioridad, setPrioridad] = useState(ticket.prioridad);
  const [presupuesto, setPresupuesto] = useState(ticket.presupuesto ?? '');
  const [negocioNombre, setNegocioNombre] = useState('');
  const [waPlantillas, setWaPlantillas] = useState({});
  const [notas, setNotas] = useState(ticket.notas_internas || '');
  const [mensaje, setMensaje] = useState('');
  const [actualizaciones, setActualizaciones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [tecnicoId, setTecnicoId] = useState(ticket.tecnico_id || '');
  const [etiquetas, setEtiquetas] = useState(ticket.etiquetas || []);

  useEffect(() => {
    supabase
      .from('ticket_actualizaciones')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setActualizaciones(data || []));
    supabase
      .from('negocios')
      .select('nombre, wa_aviso_recibido, wa_aviso_listo')
      .maybeSingle()
      .then(({ data }) => {
        setNegocioNombre(data?.nombre || '');
        setWaPlantillas({ recibido: data?.wa_aviso_recibido, listo: data?.wa_aviso_listo });
      });
    supabase.rpc('equipo_negocio').then(({ data }) => setEquipo(data || []));
  }, [ticket.id]);

  async function asignarTecnico(nuevo) {
    setTecnicoId(nuevo);
    const { error } = await supabase.rpc('asignar_tecnico', {
      p_ticket_id: ticket.id,
      p_tecnico_id: nuevo || null,
    });
    if (error) {
      setTecnicoId(ticket.tecnico_id || '');
      setAviso({ tipo: 'error', texto: error.message });
    } else {
      onGuardado();
    }
  }

  async function alternarEtiqueta(tag) {
    const { data, error } = await supabase.rpc('toggle_etiqueta', {
      p_ticket_id: ticket.id,
      p_tag: tag,
    });
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else {
      setEtiquetas(data || []);
      onGuardado();
    }
  }

  async function devolverEquipo() {
    const motivo = window.prompt(
      'Motivo de la devolución (lo ve el cliente):',
      'Equipo devuelto sin reparar'
    );
    if (motivo === null) return;
    const { error } = await supabase.rpc('devolver_equipo', {
      p_ticket_id: ticket.id,
      p_motivo: motivo,
    });
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else {
      setEstado('cancelado');
      setAviso({ tipo: 'ok', texto: 'Equipo marcado como devuelto sin reparar.' });
      onGuardado();
    }
  }

  const waArgs = {
    ticket: { ...ticket, estado },
    plantillas: waPlantillas,
    negocio: negocioNombre,
    host: typeof window !== 'undefined' ? window.location.host : '',
  };
  const waRecibido = linkAvisoWhatsApp({ ...waArgs, tipo: 'recibido' });
  const waListo = linkAvisoWhatsApp({ ...waArgs, tipo: 'listo' });

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    const pasaAListo = estado === 'listo' && ticket.estado !== 'listo';

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
    // Aviso automático al cliente cuando el equipo queda listo (no bloquea el guardado).
    if (pasaAListo) notificarOrden(ticket.id, 'listo');
    onGuardado();
    const { data } = await supabase
      .from('ticket_actualizaciones')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false });
    setActualizaciones(data || []);
  }

  const colorEstado = ESTADOS[estado]?.color || '#64748b';

  return (
    <div
      className="card ticket-detalle"
      style={{ marginBottom: 18, borderTop: `4px solid ${colorEstado}` }}
    >
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
          {waRecibido && (
            <a className="btn btn-sm" href={waRecibido} target="_blank" rel="noreferrer" title="Avisar que recibiste el equipo">
              WhatsApp: recibido
            </a>
          )}
          {waListo && (
            <a className="btn btn-sm" href={waListo} target="_blank" rel="noreferrer" title="Avisar que está listo para retirar">
              WhatsApp: listo
            </a>
          )}
          <a
            className="btn btn-secondary btn-sm"
            href={`/panel/tickets/${ticket.id}/editar`}
          >
            ✏️ Editar
          </a>
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
          {ticket.public_token && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/r/${ticket.public_token}`);
                setAviso({ tipo: 'ok', texto: 'Link de seguimiento copiado.' });
              }}
            >
              Copiar seguimiento
            </button>
          )}
          {estado !== 'entregado' && estado !== 'cancelado' && (
            <button className="btn btn-danger btn-sm" onClick={devolverEquipo}>
              Devolver sin reparar
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>

      <dl className="detalle-grid">
        <div>
          <dt>Cliente</dt>
          <dd>
            {ticket.nombre}
            {ticket.cliente_id && (
              <>
                {' · '}
                <a href={`/panel/clientes?buscar=${encodeURIComponent(ticket.telefono || ticket.nombre)}`} style={{ fontSize: '0.85rem' }}>
                  ver historial
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>DNI</dt>
          <dd style={{ fontFamily: 'var(--mono)' }}>{ticket.clientes?.dni || '—'}</dd>
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

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Técnico asignado</label>
          <select value={tecnicoId} onChange={(e) => asignarTecnico(e.target.value)}>
            <option value="">Sin asignar</option>
            {equipo.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.nombre}
                {p.rol === 'dueno' ? ' (dueño)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Etiquetas</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ETIQUETAS.map(([tag, color]) => {
              const activa = etiquetas.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className="chip"
                  onClick={() => alternarEtiqueta(tag)}
                  style={{
                    background: activa ? `${color}22` : 'transparent',
                    color: activa ? color : 'var(--text-dim)',
                    borderColor: activa ? `${color}88` : 'var(--border)',
                  }}
                >
                  {activa ? '✓ ' : ''}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {aviso && (
        <div
          className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}
          style={{ marginTop: 14 }}
        >
          {aviso.texto}
        </div>
      )}

      <div
        className="estado-banner"
        style={{
          marginTop: 16,
          background: `${colorEstado}18`,
          borderColor: `${colorEstado}55`,
        }}
      >
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label style={{ color: colorEstado }}>Estado de la orden</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={{ borderColor: `${colorEstado}88`, fontWeight: 700, color: colorEstado }}
          >
            {Object.entries(ESTADOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        {estado === 'listo' && (
          <span className="estado-banner-nota" style={{ color: colorEstado }}>
            📲 Al guardar, se avisa solo por WhatsApp
          </span>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
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

      <div className="field seccion-notas">
        <label>📝 Notas internas (no las ve el cliente)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          style={{ minHeight: 70 }}
        />
      </div>

      <div className="field seccion-publica">
        <label>💬 Nueva actualización pública (la ve el cliente al consultar)</label>
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

      <FotosTicket ticketId={ticket.id} />

      <RepuestosTicket ticketId={ticket.id} />

      <PagosTicket
        ticketId={ticket.id}
        presupuesto={ticket.presupuesto}
        onCambio={onGuardado}
      />

      {esDueno && <CostosOrden ticketId={ticket.id} />}

      {actualizaciones.length > 0 && (
        <>
          <h2 className="historial-tit" style={{ marginTop: 24, fontSize: '1rem' }}>
            🕓 Historial
          </h2>
          <div className="timeline">
            {actualizaciones.map((a) => (
              <div
                className="timeline-item"
                key={a.id}
                style={a.estado ? { '--dot-color': ESTADOS[a.estado]?.color || 'var(--accent)' } : undefined}
              >
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
  const [stats, setStats] = useState({ total: 0, abiertos: 0, porEstado: {} });
  const [userId, setUserId] = useState(null);
  const [vista, setVista] = useState('cards');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');

  useEffect(() => {
    supabase.rpc('equipo_negocio').then(({ data }) => setTecnicos(data || []));
  }, []);

  useEffect(() => {
    const v = typeof window !== 'undefined' && localStorage.getItem('ordenes_vista');
    if (v) setVista(v);
  }, []);

  function elegirVista(v) {
    setVista(v);
    try { localStorage.setItem('ordenes_vista', v); } catch { /* noop */ }
  }

  async function moverEstado(id, destino) {
    const anterior = tickets.find((t) => t.id === id)?.estado;
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, estado: destino } : t)));
    const { error: err } = await supabase.from('tickets').update({ estado: destino }).eq('id', id);
    if (err) {
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, estado: anterior } : t)));
      window.alert(err.message);
      return;
    }
    if (destino === 'listo' && anterior !== 'listo') notificarOrden(id, 'listo');
    cargar();
  }
  const timerRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    let q = supabase
      .from('tickets')
      .select('*, clientes(dni)', { count: 'exact' })
      .range(0, limite - 1);
    if (filtro === 'sin_retirar') {
      // Bandeja de retiros: listas, la que espera hace más tiempo primero
      q = q.eq('estado', 'listo').order('listo_desde', { ascending: true, nullsFirst: false });
    } else {
      q = q.order('created_at', { ascending: false });
      if (filtro === 'abiertos') q = q.not('estado', 'in', '(entregado,cancelado)');
      else if (filtro === 'mias') {
        if (userId) q = q.eq('tecnico_id', userId);
      } else if (filtro !== 'todos') q = q.eq('estado', filtro);
    }
    if (tecnicoFiltro) q = q.eq('tecnico_id', tecnicoFiltro);
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
  }, [filtro, busqueda, limite, userId, tecnicoFiltro]);

  const cargarStats = useCallback(async () => {
    const contar = (mod) => {
      let q = supabase.from('tickets').select('id', { count: 'exact', head: true });
      return mod(q).then(({ count }) => count || 0);
    };
    const claves = Object.keys(ESTADOS);
    const [total, abiertos, ...porEstadoArr] = await Promise.all([
      contar((q) => q),
      contar((q) => q.not('estado', 'in', '(entregado,cancelado)')),
      ...claves.map((k) => contar((q) => q.eq('estado', k))),
    ]);
    const porEstado = Object.fromEntries(claves.map((k, i) => [k, porEstadoArr[i]]));
    setStats({ total, abiertos, porEstado });
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

  async function exportarCSV() {
    let q = supabase
      .from('tickets')
      .select('numero, created_at, nombre, telefono, email, dispositivo, marca_modelo, estado, prioridad, presupuesto, etiquetas')
      .order('created_at', { ascending: false });
    if (filtro === 'abiertos') q = q.not('estado', 'in', '(entregado,cancelado)');
    else if (filtro === 'mias') {
      if (userId) q = q.eq('tecnico_id', userId);
    } else if (filtro !== 'todos') q = q.eq('estado', filtro);
    if (busqueda.trim()) {
      const t = busqueda.trim().replace(/[%,()]/g, '');
      q = q.or(`numero.ilike.%${t}%,nombre.ilike.%${t}%,email.ilike.%${t}%,telefono.ilike.%${t}%,marca_modelo.ilike.%${t}%`);
    }
    const { data } = await q;
    const filas = data || [];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const cols = ['numero', 'fecha', 'cliente', 'telefono', 'email', 'equipo', 'marca_modelo', 'estado', 'prioridad', 'presupuesto', 'etiquetas'];
    const lineas = [cols.join(';')];
    for (const t of filas) {
      lineas.push(
        [
          t.numero,
          new Date(t.created_at).toLocaleString('es-AR'),
          t.nombre,
          t.telefono,
          t.email,
          t.dispositivo,
          t.marca_modelo,
          ESTADOS[t.estado]?.label || t.estado,
          t.prioridad,
          t.presupuesto ?? '',
          (t.etiquetas || []).join(', '),
        ]
          .map(esc)
          .join(';')
      );
    }
    const csv = '﻿' + lineas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordenes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
        <div className="ord-toolbar">
          <div className="view-toggle">
            <button className={vista === 'cards' ? 'active' : ''} onClick={() => elegirVista('cards')}>Cards</button>
            <button className={vista === 'tabla' ? 'active' : ''} onClick={() => elegirVista('tabla')}>Tabla</button>
            <button className={vista === 'kanban' ? 'active' : ''} onClick={() => elegirVista('kanban')}>Kanban</button>
          </div>
          <a className="btn btn-sm" href="/panel/tickets/nueva">
            + Nueva orden
          </a>
          <button className="btn btn-secondary btn-sm" onClick={exportarCSV}>
            Exportar CSV
          </button>
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
            {stats.porEstado.nuevo || 0}
          </div>
          <div className="lbl">Nuevos</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#f59e0b' }}>
            {stats.porEstado.en_reparacion || 0}
          </div>
          <div className="lbl">En reparación</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#22c55e' }}>
            {stats.porEstado.listo || 0}
          </div>
          <div className="lbl">Listos</div>
        </div>
      </div>

      {seleccionado && (
        <DetalleTicket
          key={seleccionado.id}
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
          ['abiertos', 'Abiertos', stats.abiertos],
          ['mias', 'Mías', null],
          ['sin_retirar', 'Sin retirar', null],
          ['todos', 'Todos', stats.total],
          ...Object.entries(ESTADOS).map(([k, v]) => [k, v.label, stats.porEstado[k] || 0]),
        ].map(([k, label, count]) => (
          <button
            key={k}
            className={`chip ${filtro === k ? 'active' : ''}`}
            onClick={() => {
              setFiltro(k);
              setLimite(100);
            }}
          >
            {label}
            {count != null && <span style={{ opacity: 0.65 }}> · {count}</span>}
          </button>
        ))}
      </div>

      {tecnicos.length > 0 && (
        <div className="filters" style={{ marginTop: 8 }}>
          <button
            className={`chip ${!tecnicoFiltro ? 'active' : ''}`}
            onClick={() => { setTecnicoFiltro(''); setLimite(100); }}
          >
            👨‍🔧 Todos los técnicos
          </button>
          {tecnicos.map((p) => (
            <button
              key={p.user_id}
              className={`chip ${tecnicoFiltro === p.user_id ? 'active' : ''}`}
              onClick={() => { setTecnicoFiltro(p.user_id); setLimite(100); }}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {cargando ? (
        <p style={{ color: 'var(--text-dim)' }}>Cargando tickets...</p>
      ) : visibles.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>
          No hay tickets que coincidan con el filtro.
        </p>
      ) : vista === 'kanban' ? (
        <div className="kanban">
          {KANBAN_COLS.map((col) => {
            const items = visibles.filter((t) => col.estados.includes(t.estado));
            return (
              <div className="kanban-col" key={col.key}>
                <div className="kanban-head" style={{ color: col.color, borderColor: col.color }}>
                  <span>{col.label}</span>
                  <span style={{ background: `${col.color}22`, padding: '1px 8px', borderRadius: 20 }}>{items.length}</span>
                </div>
                <div
                  className={`kanban-body ${overCol === col.key ? 'over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                  onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverCol(null);
                    if (dragId) {
                      const t = visibles.find((x) => x.id === dragId);
                      if (t && t.estado !== col.destino) moverEstado(dragId, col.destino);
                      setDragId(null);
                    }
                  }}
                >
                  {items.map((t) => (
                    <div
                      className={`kanban-card ${dragId === t.id ? 'drag' : ''}`}
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => { setSeleccionado(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    >
                      <div style={{ color: 'var(--text-dim)', fontSize: '.7rem' }}>{t.numero}</div>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '.72rem' }}>{t.marca_modelo || t.dispositivo}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : vista === 'tabla' ? (
        <div className="tabla-scroll">
          <table className="ord-tabla">
            <thead>
              <tr><th>#</th><th>Cliente</th><th>Equipo</th><th>Estado</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {visibles.map((t) => (
                <tr key={t.id} onClick={() => { setSeleccionado(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{t.numero}</td>
                  <td>{t.nombre}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{t.dispositivo}{t.marca_modelo ? ` ${t.marca_modelo}` : ''}</td>
                  <td><BadgeEstado estado={t.estado} /></td>
                  <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{formatFecha(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ord-cards">
          {visibles.map((t) => {
            const color = ESTADOS[t.estado]?.color || '#94a3b8';
            const urgente = ['alta', 'urgente'].includes(t.prioridad);
            return (
              <div className="ord-card" key={t.id} onClick={() => { setSeleccionado(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <div className="ord-stripe" style={{ background: color }} />
                <div className="ord-card-body">
                  <div className="ord-av" style={{ background: avColorOrd(t.nombre) }}>{inicialesOrd(t.nombre)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.72rem', color: 'var(--text-dim)', fontWeight: 700 }}>{t.numero}</span>
                      <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{t.nombre}</span>
                      {urgente && <span style={{ color: '#ef4444', fontSize: '.7rem', fontWeight: 700 }}>{PRIORIDADES[t.prioridad]}</span>}
                    </div>
                    <div style={{ fontSize: '.82rem', color: 'var(--text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.dispositivo}{t.marca_modelo ? ` — ${t.marca_modelo}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                      <BadgeEstado estado={t.estado} />
                      <span style={{ fontSize: '.72rem', color: 'var(--text-dim)' }}>{formatFecha(t.created_at)}</span>
                      {t.estado === 'listo' && t.listo_desde != null && (
                        <span style={{ fontSize: '.72rem', color: 'var(--warn)' }}>· sin retirar {diasDesde(t.listo_desde)}d</span>
                      )}
                    </div>
                    <ChipsEtiquetas etiquetas={t.etiquetas} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
