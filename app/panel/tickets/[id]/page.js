'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  supabase,
  ESTADOS,
  ESTADOS_SELECCIONABLES,
  ETIQUETAS_TICKET,
  PRIORIDADES,
  METODOS_PAGO,
  formatFecha,
  formatMoney,
} from '@/lib/supabase';
import { linkAvisoWhatsApp, telWhatsApp } from '@/lib/whatsapp';
import { usePerfil } from '@/lib/panel-context';
import { useCobroReal, ModalCobroReal, METODOS_ELECTRONICOS_ORDEN } from '@/components/cobro-real';
import { PantallaCarga } from '@/components/cargando';

const ETIQUETAS = ETIQUETAS_TICKET.map((e) => [e.tag, e.color]);

// Cuotas con recargo de tarjeta de crédito — igual que en el POS. Solo
// aplica cuando el pago se registra a mano (sin Facturá conectada): con
// Facturá, "tarjeta" pasa por el checkout de Mercado Pago, que maneja sus
// propias cuotas.
const CUOTAS_TC = [
  [1, 10],
  [2, 20],
  [3, 30],
  [6, 40],
];

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

function idemKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

const ICONO_ETIQUETA = {
  Urgente: '🔴',
  Garantía: '🛡️',
  'Sin pago': '💰',
  'Esperando repuesto': '⏳',
  'Cliente avisado': '✅',
  'Presupuesto enviado': '📩',
};

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

function PagosTicket({ ticketId, presupuesto, onCambio, onSaldo }) {
  const [pagos, setPagos] = useState([]);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [anulandoId, setAnulandoId] = useState(null);
  const [interesSena, setInteresSena] = useState(0);
  const [interesDesglose, setInteresDesglose] = useState({});
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

  useEffect(() => {
    onSaldo?.(saldo);
  }, [saldo, onSaldo]);

  async function anularPago(pago) {
    if (!window.confirm(`¿Anular este pago de ${formatMoney(pago.monto)}? Queda registrado como reversión.`)) return;
    setAnulandoId(pago.id);
    setError(null);
    const { error: err } = await supabase.rpc('anular_pago_orden', { p_pago_id: pago.id });
    setAnulandoId(null);
    if (err) {
      setError(err.message);
      return;
    }
    cargar();
    onCambio?.();
  }

  // registrar una seña suelta (feeds caja + idempotencia)
  async function agregarSena(e) {
    e.preventDefault();
    if (ocupado) return;
    setError(null);
    const conRecargo = !facturaConectada && metodo === 'tarjeta' && interesSena > 0;
    const montoNum = conRecargo ? Math.round(Number(monto) * (1 + interesSena / 100) * 100) / 100 : Number(monto);

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
      .map((p, i) => {
        const pct = !facturaConectada && p.metodo === 'tarjeta' ? interesDesglose[i] || 0 : 0;
        const monto = pct > 0 ? Math.round(Number(p.monto) * (1 + pct / 100) * 100) / 100 : Number(p.monto);
        return { monto, metodo: p.metodo, mp_payment_id: p.mp_payment_id || null };
      })
      .filter((p) => p.monto > 0);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="subtotal" style={{ color: Number(p.monto) < 0 ? 'var(--error-soft)' : 'inherit' }}>
              {formatMoney(p.monto)}
            </div>
            {Number(p.monto) > 0 && (
              <button
                type="button"
                className="btn-icono-borrar"
                title="Anular este pago"
                disabled={anulandoId === p.id}
                onClick={() => anularPago(p)}
              >
                {anulandoId === p.id ? <span className="spinner" /> : '✕'}
              </button>
            )}
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
                  {!facturaConectada && p.metodo === 'tarjeta' && (
                    <div className="pos-cuotas" style={{ gridColumn: '1 / -1' }}>
                      <div className="pos-cuotas-lbl">💳 Cuotas con tarjeta de crédito</div>
                      <div className="pos-cuotas-grid">
                        {CUOTAS_TC.map(([n, pct]) => (
                          <button
                            key={n}
                            type="button"
                            className={`cuota-btn ${interesDesglose[i] === pct ? 'active' : ''}`}
                            onClick={() => setInteresDesglose((prev) => ({ ...prev, [i]: pct }))}
                          >
                            {n}x<br />
                            <span>+{pct}%</span>
                          </button>
                        ))}
                      </div>
                      {interesDesglose[i] > 0 && p.monto && (
                        <div className="pos-interes-pill">
                          <span>💳 Total con recargo</span>
                          <strong>{formatMoney(Math.round(Number(p.monto) * (1 + interesDesglose[i] / 100) * 100) / 100)}</strong>
                        </div>
                      )}
                    </div>
                  )}
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
              <select value={metodo} onChange={(e) => { setMetodo(e.target.value); setInteresSena(0); }}>
                {Object.entries(METODOS_PAGO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!facturaConectada && metodo === 'tarjeta' && (
            <div className="pos-cuotas">
              <div className="pos-cuotas-lbl">💳 Cuotas con tarjeta de crédito</div>
              <div className="pos-cuotas-grid">
                {CUOTAS_TC.map(([n, pct]) => (
                  <button
                    key={n}
                    type="button"
                    className={`cuota-btn ${interesSena === pct ? 'active' : ''}`}
                    onClick={() => setInteresSena(pct)}
                  >
                    {n}x<br />
                    <span>+{pct}%</span>
                  </button>
                ))}
              </div>
              {interesSena > 0 && monto && (
                <div className="pos-interes-pill">
                  <span>💳 Total con recargo</span>
                  <strong>{formatMoney(Math.round(Number(monto) * (1 + interesSena / 100) * 100) / 100)}</strong>
                </div>
              )}
            </div>
          )}
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
const TIPOS_FOTO = [
  ['todas', 'Todas'],
  ['antes', 'Antes'],
  ['durante', 'Durante'],
  ['despues', 'Después'],
];

function FotosTicket({ ticketId }) {
  const [fotos, setFotos] = useState([]);
  const [negocioId, setNegocioId] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [tipoSubida, setTipoSubida] = useState('antes');
  const [filtroTipo, setFiltroTipo] = useState('todas');

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('ticket_fotos')
      .select('id, path, url, tipo, created_at')
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
          p_tipo: tipoSubida,
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

  const visibles = filtroTipo === 'todas' ? fotos : fotos.filter((f) => f.tipo === filtroTipo);
  const etiquetaTipo = { antes: 'Antes', durante: 'Durante', despues: 'Después' };

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: '1rem' }}>Fotos del equipo</h2>
      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {fotos.length > 0 && (
        <div className="filters" style={{ marginTop: 8, marginBottom: 8 }}>
          {TIPOS_FOTO.map(([k, l]) => (
            <button key={k} className={`chip ${filtroTipo === k ? 'active' : ''}`} onClick={() => setFiltroTipo(k)}>
              {l} {k !== 'todas' && `(${fotos.filter((f) => f.tipo === k).length})`}
            </button>
          ))}
        </div>
      )}
      {visibles.length > 0 && (
        <div className="fotos-grid">
          {visibles.map((f) => (
            <div className="foto-item" key={f.id}>
              <a href={f.url} target="_blank" rel="noreferrer">
                <img src={f.url} alt={`Foto del equipo — ${etiquetaTipo[f.tipo] || f.tipo}`} loading="lazy" />
              </a>
              <span className="badge foto-tipo-badge">{etiquetaTipo[f.tipo] || f.tipo}</span>
              <button className="foto-del" onClick={() => eliminar(f)} aria-label="Eliminar">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <select value={tipoSubida} onChange={(e) => setTipoSubida(e.target.value)} style={{ width: 'auto' }}>
          <option value="antes">Antes</option>
          <option value="durante">Durante</option>
          <option value="despues">Después</option>
        </select>
        <label className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', cursor: 'pointer' }}>
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

  const pctMargen = m.presupuesto > 0 ? Math.round((m.margen / m.presupuesto) * 100) : null;
  const colorMargen = m.margen >= 0 ? 'var(--ok)' : 'var(--error-soft)';

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
          <strong style={{ color: colorMargen, display: 'flex', alignItems: 'center', gap: 6 }}>
            {formatMoney(m.margen)}
            {pctMargen != null && (
              <span className="badge" style={{ color: colorMargen, background: `${colorMargen === 'var(--ok)' ? 'rgba(52,211,153,.14)' : 'rgba(248,113,113,.14)'}` }}>
                {pctMargen}%
              </span>
            )}
          </strong>
        </div>
      </div>
      {pctMargen != null && (
        <div className="barra-progreso" style={{ marginTop: 8 }}>
          <div
            className="barra-progreso-fill"
            style={{ width: `${Math.min(100, Math.max(0, pctMargen))}%`, background: colorMargen }}
          />
        </div>
      )}
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

// Otras órdenes del mismo cliente, inline (v1 las mostraba en una tabla
// embebida en el propio detalle, no como un link a otra pantalla).
function HistorialCliente({ clienteId, ticketId }) {
  const [otras, setOtras] = useState(null);

  useEffect(() => {
    supabase
      .from('tickets')
      .select('id, numero, marca_modelo, dispositivo, estado, created_at')
      .eq('cliente_id', clienteId)
      .neq('id', ticketId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setOtras(data || []));
  }, [clienteId, ticketId]);

  if (!otras || otras.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <p className="lbl2" style={{ marginBottom: 6 }}>Otras órdenes de este cliente</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {otras.map((o) => (
          <a
            key={o.id}
            href={`/panel/tickets/${o.id}`}
            style={{
              display: 'flex', justifyContent: 'space-between', gap: 8,
              fontSize: '0.82rem', padding: '5px 0', borderBottom: '1px solid var(--border)',
            }}
          >
            <span>
              {o.numero} · {o.marca_modelo || o.dispositivo}
            </span>
            <BadgeEstado estado={o.estado} />
          </a>
        ))}
      </div>
    </div>
  );
}

function DetalleTicket({ ticket, onCerrar, onGuardado }) {
  const { esDueno, perfil } = usePerfil();
  // Vista restringida: el técnico asignado a ESTA orden ve lo que necesita
  // para trabajar (equipo, falla, fotos, notas, estado) pero no cobra, no
  // toca precios ni datos del cliente — igual que orden_tecnico.html en v1.
  // No se aplica a todo el rol "operador" para no romper caja/mostrador de
  // quienes atienden órdenes que no son suyas.
  const vistaTecnico = !esDueno && !!perfil?.user_id && perfil.user_id === ticket.tecnico_id;
  const [estado, setEstado] = useState(ticket.estado);
  const [prioridad, setPrioridad] = useState(ticket.prioridad);
  const [presupuesto, setPresupuesto] = useState(ticket.presupuesto ?? '');
  const [saldoPendiente, setSaldoPendiente] = useState(0);
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
  const [enviandoEncuesta, setEnviandoEncuesta] = useState(false);

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

  async function enviarEncuesta() {
    setEnviandoEncuesta(true);
    const { data, error } = await supabase.rpc('crear_encuesta', { p_ticket_id: ticket.id });
    setEnviandoEncuesta(false);
    if (error) {
      setAviso({ tipo: 'error', texto: error.message });
      return;
    }
    const tel = telWhatsApp(ticket.telefono);
    const url = `${window.location.origin}/encuesta/${data.token}`;
    const texto = `Hola ${ticket.nombre}! 🙏 ¿Nos ayudás con una encuesta rápida sobre tu experiencia con la reparación de tu ${ticket.marca_modelo || ticket.dispositivo}? ${url}`;
    if (tel) window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank');
    else window.open(url, '_blank');
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
      setEstado('entregado_sr');
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
  const waPresupuesto = ticket.presupuesto != null ? linkAvisoWhatsApp({ ...waArgs, tipo: 'presupuesto' }) : null;

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    const pasaAListo = estado === 'reparado' && ticket.estado !== 'reparado';

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
    const cambioEstado = estado !== ticket.estado;

    // Siempre queda un registro en el historial cuando cambia el estado,
    // aunque el operador no haya escrito nada — antes se perdía esa
    // trazabilidad si el mensaje quedaba vacío.
    if (!errMsg && (mensaje.trim() || cambioEstado)) {
      const { error: errMsj } = await supabase
        .from('ticket_actualizaciones')
        .insert({
          ticket_id: ticket.id,
          mensaje: mensaje.trim() || `Estado actualizado a "${ESTADOS[estado]?.label || estado}".`,
          estado: cambioEstado ? estado : null,
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
  const diasEnTaller = diasDesde(ticket.created_at);
  const enTaller = !['entregado', 'entregado_sr', 'no_reparado', 'cancelado'].includes(estado);

  return (
    <div className="ticket-detalle" style={{ marginBottom: 18 }}>
      {/* ═══ Cabecera ═══ */}
      <div className="orden-header card" style={{ padding: 0, marginBottom: 16 }}>
        <div className="orden-header-stripe" style={{ background: colorEstado }} />
        <div className="orden-header-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div className="orden-av" style={{ background: `${colorEstado}22`, borderColor: `${colorEstado}55` }}>
              {(ticket.marca_modelo || ticket.dispositivo || '?').slice(0, 3).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 900 }}>{vistaTecnico ? ticket.numero : ticket.nombre}</span>
                <span
                  className="badge"
                  style={{
                    fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)',
                    background: 'var(--accent-soft)',
                  }}
                >
                  #{ticket.numero}
                </span>
                <BadgeEstado estado={estado} />
                {diasEnTaller > 14 && enTaller && (
                  <span className="badge" style={{ fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,.1)' }}>
                    ⚠ {diasEnTaller} días en taller
                  </span>
                )}
              </div>
              <div style={{ fontSize: '.85rem', color: 'var(--text-dim)', marginBottom: 2 }}>
                📱 {ticket.dispositivo}{ticket.marca_modelo ? ` ${ticket.marca_modelo}` : ''}
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--text-dim)' }}>
                Ingresado: {formatFecha(ticket.created_at)}
              </div>
              {ticket.public_token && !vistaTecnico && (
                <div style={{ fontSize: '.72rem', marginTop: 3 }}>
                  🔗{' '}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${window.location.origin}/r/${ticket.public_token}`);
                      setAviso({ tipo: 'ok', texto: 'Link de seguimiento copiado.' });
                    }}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 'inherit' }}
                  >
                    Copiar link de estado público
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
            {waRecibido && (
              <a className="btn btn-sm" href={waRecibido} target="_blank" rel="noreferrer" title="Avisar que recibiste el equipo">
                💬 WhatsApp: recibido
              </a>
            )}
            {waListo && (
              <a className="btn btn-sm" href={waListo} target="_blank" rel="noreferrer" title="Avisar que está listo para retirar">
                💬 WhatsApp: listo
              </a>
            )}
            {waPresupuesto && (
              <a className="btn btn-sm" href={waPresupuesto} target="_blank" rel="noreferrer" title="Enviar el presupuesto por WhatsApp">
                📋 Presupuesto
              </a>
            )}
            {['reparado', 'entregado'].includes(ticket.estado) && (
              <button className="btn btn-secondary btn-sm" onClick={enviarEncuesta} disabled={enviandoEncuesta} title="Enviar encuesta de satisfacción por WhatsApp">
                {enviandoEncuesta ? <span className="spinner" /> : '⭐ Encuesta'}
              </button>
            )}
            {!vistaTecnico && (
              <a className="btn btn-secondary btn-sm" href={`/panel/tickets/${ticket.id}/editar`}>
                ✏️ Editar
              </a>
            )}
            <a className="btn btn-secondary btn-sm" href={`/panel/imprimir/${ticket.id}`}>
              🖨️ Comprobante
            </a>
            {!vistaTecnico && ['reparado', 'entregado'].includes(ticket.estado) && (
              <a className="btn btn-secondary btn-sm" href={`/panel/garantia/${ticket.id}`} title="Comprobante de entrega con garantía">
                🛡️ Garantía
              </a>
            )}
            <a className="btn btn-secondary btn-sm" href={`/panel/etiqueta/${ticket.id}`}>
              Etiqueta
            </a>
            {!vistaTecnico && enTaller && (
              <button className="btn btn-danger btn-sm" onClick={devolverEquipo}>
                Devolver sin reparar
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={onCerrar}>
              ← Volver
            </button>
          </div>
        </div>

        {!vistaTecnico && (
          <div className="orden-header-tags">
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
                  {ICONO_ETIQUETA[tag] || ''} {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!vistaTecnico && estado === 'reparado' && saldoPendiente > 0 && (
        <a href="#pagos-orden" className="banner-cobrar">
          <span className="banner-cobrar-txt">
            <strong>Listo para entregar</strong> — falta cobrar {formatMoney(saldoPendiente)}
          </span>
          <span className="btn btn-sm">Cobrar y entregar →</span>
        </a>
      )}

      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`} style={{ marginBottom: 16 }}>
          {aviso.texto}
        </div>
      )}

      {/* ═══ 2 columnas: principal + lateral ═══ */}
      <div className="detalle-2col">
        <div className="detalle-col">
          {!vistaTecnico && (
            <div className="card">
              <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Cliente</h2>
              <dl className="detalle-grid">
                <div>
                  <dt>Nombre</dt>
                  <dd>{ticket.nombre}</dd>
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
              </dl>
              {ticket.cliente_id && <HistorialCliente clienteId={ticket.cliente_id} ticketId={ticket.id} />}
            </div>
          )}

          <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Equipo y falla</h2>
            <dl className="detalle-grid">
              {ticket.color && (
                <div>
                  <dt>Color</dt>
                  <dd>{ticket.color}</dd>
                </div>
              )}
              {ticket.imei_serial && (
                <div>
                  <dt>IMEI / Serie</dt>
                  <dd style={{ fontFamily: 'var(--mono)' }}>{ticket.imei_serial}</dd>
                </div>
              )}
              {ticket.estado_pantalla && (
                <div>
                  <dt>Estado de la pantalla</dt>
                  <dd>{ticket.estado_pantalla}</dd>
                </div>
              )}
              {ticket.condicion_general && (
                <div>
                  <dt>Condición general</dt>
                  <dd>{ticket.condicion_general}</dd>
                </div>
              )}
              {ticket.modo_ingreso?.length > 0 && (
                <div>
                  <dt>Cómo ingresó</dt>
                  <dd>{ticket.modo_ingreso.join(', ')}</dd>
                </div>
              )}
              {ticket.accesorios?.length > 0 && (
                <div>
                  <dt>Accesorios</dt>
                  <dd>{ticket.accesorios.join(', ')}</dd>
                </div>
              )}
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
                marginTop: ticket.equipo_password || ticket.v1_id ? 10 : 0,
              }}
            >
              {ticket.descripcion}
            </p>
            {ticket.condicion_fisica && (
              <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <strong style={{ color: 'var(--text)' }}>Condición física al recibir: </strong>
                {ticket.condicion_fisica}
              </p>
            )}
            <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
              <label>Técnico asignado</label>
              {vistaTecnico ? (
                <p style={{ margin: 0 }}>{equipo.find((p) => p.user_id === tecnicoId)?.nombre || 'Vos'}</p>
              ) : (
                <select value={tecnicoId} onChange={(e) => asignarTecnico(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {equipo.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.nombre}
                      {p.rol === 'dueno' ? ' (dueño)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="card">
            <div className="field seccion-notas" style={{ marginBottom: 0 }}>
              <label>📝 Notas internas (no las ve el cliente)</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} style={{ minHeight: 70 }} />
            </div>
          </div>

          <div className="card">
            <FotosTicket ticketId={ticket.id} />
            <RepuestosTicket ticketId={ticket.id} />
          </div>

          {actualizaciones.length > 0 && (
            <div className="card">
              <h2 className="historial-tit" style={{ fontSize: '1rem', marginBottom: 10 }}>
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
            </div>
          )}
        </div>

        <div className="detalle-col">
          <div className="card">
            <div
              className="estado-banner"
              style={{ background: `${colorEstado}18`, borderColor: `${colorEstado}55` }}
            >
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label style={{ color: colorEstado }}>Estado de la orden</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  style={{ borderColor: `${colorEstado}88`, fontWeight: 700, color: colorEstado }}
                >
                  {ESTADOS_SELECCIONABLES.map((k) => (
                    <option key={k} value={k}>
                      {ESTADOS[k].label}
                    </option>
                  ))}
                </select>
              </div>
              {estado === 'reparado' && (
                <span className="estado-banner-nota" style={{ color: colorEstado }}>
                  📲 Al guardar, se avisa solo por WhatsApp
                </span>
              )}
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Prioridad</label>
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                {Object.entries(PRIORIDADES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {!vistaTecnico && (
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
            )}
            <div className="field seccion-publica">
              <label>💬 Nueva actualización pública (la ve el cliente al consultar)</label>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                style={{ minHeight: 60 }}
                placeholder="Ej: Presupuesto enviado por email, esperamos tu confirmación."
              />
            </div>
            <button className="btn" onClick={guardar} disabled={guardando} style={{ width: '100%' }}>
              {guardando ? <span className="spinner" /> : 'Guardar cambios'}
            </button>
          </div>

          {!vistaTecnico && (
            <div className="card" id="pagos-orden">
              <PagosTicket ticketId={ticket.id} presupuesto={ticket.presupuesto} onCambio={onGuardado} onSaldo={setSaldoPendiente} />
            </div>
          )}

          {esDueno && (
            <div className="card">
              <CostosOrden ticketId={ticket.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const AVATAR_ESTADO = { recibido: '📥', en_proceso: '⚙️', reparado: '✅' };

// Vista del técnico asignado a la orden — calcada de orden_tecnico.html en
// v1: solo lo que necesita para trabajar (equipo, falla, fotos, notas,
// estado), sin cliente, sin precios, sin cobro. Es un componente aparte
// (no DetalleTicket con secciones ocultas) para que se vea y se sienta
// como la pantalla simple que ya conocen los técnicos de v1.
function DetalleTecnico({ ticket, onCerrar, onGuardado }) {
  const [estado, setEstado] = useState(ticket.estado);
  const [notas, setNotas] = useState(ticket.notas_internas || '');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    const { error: errUpd } = await supabase
      .from('tickets')
      .update({ estado, notas_internas: notas })
      .eq('id', ticket.id);
    setGuardando(false);
    if (errUpd) {
      setAviso({ tipo: 'error', texto: errUpd.message });
      return;
    }
    setAviso({ tipo: 'ok', texto: 'Cambios guardados.' });
    onGuardado();
  }

  const colorEstado = ESTADOS[estado]?.color || '#64748b';
  const datosEquipo = [
    ['Marca / modelo', ticket.marca_modelo],
    ['Color', ticket.color],
    ['IMEI / Serie', ticket.imei_serial],
    ['Condición física', ticket.condicion_fisica],
    ['Condición general', ticket.condicion_general],
    ['Accesorios', ticket.accesorios?.join(', ')],
    ['Cómo ingresó', ticket.modo_ingreso?.join(', ')],
  ].filter(([, v]) => v);

  return (
    <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="orden-header card" style={{ padding: 0 }}>
        <div className="orden-header-stripe" style={{ background: colorEstado }} />
        <div className="orden-header-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="orden-av" style={{ background: `${colorEstado}22`, borderColor: `${colorEstado}55`, fontSize: '1.4rem' }}>
              {AVATAR_ESTADO[estado] || '📦'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{ticket.nombre}</span>
                <span
                  style={{
                    fontFamily: 'var(--mono)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)',
                    background: 'var(--accent-soft)', padding: '2px 10px', borderRadius: 20,
                  }}
                >
                  #{ticket.numero}
                </span>
                <BadgeEstado estado={estado} />
              </div>
              <div style={{ fontSize: '.85rem', color: 'var(--text-dim)' }}>
                📱 {ticket.dispositivo}{ticket.marca_modelo ? ` ${ticket.marca_modelo}` : ''}{ticket.color ? ` · ${ticket.color}` : ''}
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--text-dim)', marginTop: 2 }}>
                Ingresado: {formatFecha(ticket.created_at)}
              </div>
            </div>
          </div>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={onCerrar}>
              ← Mis órdenes
            </button>
          </div>
        </div>
      </div>

      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{aviso.texto}</div>
      )}

      <div className="detalle-2col">
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>📱 Datos del equipo</h2>
          {datosEquipo.length === 0 ? (
            <p className="lbl2">Sin datos adicionales cargados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datosEquipo.map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', minWidth: 110, flexShrink: 0 }}>
                    {lbl}
                  </span>
                  <span style={{ fontSize: '.88rem' }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>🔧 Trabajo a realizar</h2>
          {ticket.tipo_reparacion?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="lbl2" style={{ marginBottom: 4 }}>Tipo</div>
              <div style={{ fontWeight: 600 }}>{ticket.tipo_reparacion.join(', ')}</div>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div className="lbl2" style={{ marginBottom: 4 }}>Problema reportado</div>
            <div style={{ lineHeight: 1.5 }}>{ticket.descripcion}</div>
          </div>
          {ticket.equipo_password && (
            <div
              style={{
                background: 'rgba(245,158,11,.08)', border: '1.5px solid rgba(245,158,11,.3)',
                borderRadius: 10, padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#FBBF24', marginBottom: 5 }}>
                🔐 Contraseña / Patrón
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: '.05em' }}>
                {ticket.equipo_password}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Estado</h2>
        <div className="field" style={{ marginBottom: 12 }}>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS_SELECCIONABLES.map((k) => (
              <option key={k} value={k}>
                {ESTADOS[k].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>📝 Notas internas</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Anotá el diagnóstico, estado del repuesto, observación..." />
        </div>
        <button className="btn" onClick={guardar} disabled={guardando}>
          {guardando ? <span className="spinner" /> : 'Guardar'}
        </button>
      </div>

      <div className="card">
        <FotosTicket ticketId={ticket.id} />
        <RepuestosTicket ticketId={ticket.id} />
      </div>
    </div>
  );
}

export default function OrdenDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const { esDueno, perfil } = usePerfil();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('tickets')
      .select('*, clientes(dni)')
      .eq('id', id)
      .maybeSingle();
    if (err || !data) {
      setError('No se encontró la orden.');
      return;
    }
    setTicket(data);
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!ticket) return <PantallaCarga />;

  // El técnico asignado a ESTA orden ve la vista simplificada de v1 (sin
  // cliente, sin precios, sin cobro). No se aplica a todo el rol operador
  // para no romper caja/mostrador de quienes atienden órdenes que no son
  // suyas.
  const vistaTecnico = !esDueno && !!perfil?.user_id && perfil.user_id === ticket.tecnico_id;
  const Detalle = vistaTecnico ? DetalleTecnico : DetalleTicket;

  return (
    <main>
      <Detalle
        key={ticket.id}
        ticket={ticket}
        onCerrar={() => router.push('/panel/tickets')}
        onGuardado={cargar}
      />
    </main>
  );
}
