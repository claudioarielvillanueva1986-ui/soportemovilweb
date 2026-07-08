'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, METODOS_PAGO, formatMoney, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

const CATEGORIAS_MOV = {
  egreso: ['insumos', 'servicios', 'sueldos', 'alquiler', 'proveedor', 'retiro', 'otro'],
  ingreso: ['aporte', 'cobro', 'otro'],
};

const COLOR_METODO = {
  efectivo: '#22c55e',
  transferencia: '#3b82f6',
  debito: '#94a3b8',
  credito: '#a855f7',
  tarjeta: '#a855f7',
  mercadopago_qr: '#14b8a6',
  mercadopago_point: '#14b8a6',
  mixto: '#f59e0b',
};

function badgeMetodo(m) {
  const c = COLOR_METODO[m] || '#94a3b8';
  return (
    <span className="mp-badge" style={{ color: c, borderColor: `${c}66`, background: `${c}1a` }}>
      {METODOS_PAGO[m] || m}
    </span>
  );
}

function hora(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function CajaPage() {
  const [turno, setTurno] = useState(undefined);
  const [ventas, setVentas] = useState([]);
  const [ventaPagos, setVentaPagos] = useState([]);
  const [pagosOrdenes, setPagosOrdenes] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [facturaConectada, setFacturaConectada] = useState(false);
  const [facturandoId, setFacturandoId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [montoInicial, setMontoInicial] = useState('');
  const [mov, setMov] = useState({ tipo: 'egreso', categoria: 'insumos', monto: '', motivo: '' });
  const [declarado, setDeclarado] = useState('');
  const [cierre, setCierre] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data: resumen } = await supabase.rpc('resumen_panel');
    const t = resumen?.turno || null;
    setTurno(t);
    if (t) {
      const [{ data: vs }, { data: rs }, { data: ms }, { data: tp }] = await Promise.all([
        supabase.from('ventas').select('*').eq('turno_id', t.id).order('created_at', { ascending: false }),
        supabase.from('retiros_caja').select('*').eq('turno_id', t.id).order('created_at', { ascending: false }),
        supabase.from('movimientos_caja').select('*').eq('turno_id', t.id).order('created_at', { ascending: false }),
        supabase.from('ticket_pagos').select('*, tickets(numero, nombre)').eq('turno_id', t.id).order('created_at', { ascending: false }),
      ]);
      setVentas(vs || []);
      setRetiros(rs || []);
      setMovimientos(ms || []);
      setPagosOrdenes(tp || []);
      // Pagos mixtos: cada venta puede tener su desglose real en venta_pagos
      // (registrar_venta_pos siempre inserta ahí); sin esto, una venta "mixta"
      // no se contaba ni como efectivo ni como electrónico en esta pantalla.
      const idsVentas = (vs || []).map((v) => v.id);
      if (idsVentas.length) {
        const { data: vp } = await supabase.from('venta_pagos').select('*').in('venta_id', idsVentas);
        setVentaPagos(vp || []);
      } else {
        setVentaPagos([]);
      }
    } else {
      const { data: hs } = await supabase
        .from('turnos_caja')
        .select('*')
        .eq('estado', 'cerrado')
        .order('cerrado_at', { ascending: false })
        .limit(10);
      setHistorial(hs || []);
    }
  }, []);

  useEffect(() => {
    cargar();
    supabase
      .from('facturacion_conexion')
      .select('conectado')
      .maybeSingle()
      .then(({ data }) => setFacturaConectada(!!data?.conectado));
  }, [cargar]);

  async function abrir(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.rpc('abrir_turno', { p_monto_inicial: Number(montoInicial) });
    setOcupado(false);
    if (err) return setError(err.message);
    setCierre(null);
    setMontoInicial('');
    cargar();
  }

  async function registrarMov(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.rpc('registrar_movimiento', {
      p_tipo: mov.tipo,
      p_categoria: mov.categoria,
      p_monto: Number(mov.monto),
      p_motivo: mov.motivo,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setMov({ tipo: 'egreso', categoria: 'insumos', monto: '', motivo: '' });
    cargar();
  }

  async function cerrar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const { data, error: err } = await supabase.rpc('cerrar_turno', {
      p_monto_declarado: declarado === '' ? null : Number(declarado),
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setCierre(data);
    setDeclarado('');
    cargar();
  }

  async function facturar(v) {
    setFacturandoId(v.id);
    setError(null);
    const { data: sesion } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/facturacion/facturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token || ''}` },
        body: JSON.stringify({ venta_id: v.id }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'No se pudo facturar');
      else cargar();
    } catch (e) {
      setError(e.message);
    }
    setFacturandoId(null);
  }

  if (turno === undefined) return <PantallaCarga />;

  // ── Cálculos del turno ──
  // Fuente de verdad del efectivo esperado: resumen_panel() ya suma turno,
  // pagos mixtos (venta_pagos), cobros de órdenes (ticket_pagos), movimientos
  // y retiros exactamente igual que cerrar_turno — no se recalcula acá para
  // evitar que esta pantalla "en vivo" diverja del cierre real.
  const esperado = turno ? Number(turno.efectivo_esperado) : 0;

  const ventasActivas = ventas.filter((v) => !v.anulada);
  const idsVentasActivas = new Set(ventasActivas.map((v) => v.id));
  const pagosVentasActivas = ventaPagos.filter((p) => idsVentasActivas.has(p.venta_id));
  const ventasConDesglose = new Set(pagosVentasActivas.map((p) => p.venta_id));

  let totalVentas = 0;
  let ventasEfectivo = 0;
  let ventasElectronico = 0;
  for (const v of ventasActivas) {
    totalVentas += Number(v.total);
    // Ventas sin fila en venta_pagos (legado): usar metodo_pago + total tal cual.
    if (!ventasConDesglose.has(v.id)) {
      if (v.metodo_pago === 'efectivo') ventasEfectivo += Number(v.total);
      else ventasElectronico += Number(v.total);
    }
  }
  for (const p of pagosVentasActivas) {
    if (p.metodo === 'efectivo') ventasEfectivo += Number(p.monto);
    else ventasElectronico += Number(p.monto);
  }

  const pagosOrdenesEfectivo = pagosOrdenes.filter((p) => p.metodo === 'efectivo').reduce((s, p) => s + Number(p.monto), 0);
  const pagosOrdenesElectronico = pagosOrdenes.filter((p) => p.metodo !== 'efectivo').reduce((s, p) => s + Number(p.monto), 0);
  const totalElectronico = Math.round((ventasElectronico + pagosOrdenesElectronico) * 100) / 100;

  // retiros = egresos categoría "retiro"; se muestran junto a los movimientos
  const movsTodos = [
    ...movimientos,
    ...retiros.map((r) => ({
      id: 'r' + r.id,
      tipo: 'egreso',
      categoria: 'retiro',
      monto: r.monto,
      motivo: r.motivo,
      created_at: r.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const movIngresos = movsTodos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const movEgresos = movsTodos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0);

  const gastosPorCat = Object.entries(
    movsTodos
      .filter((m) => m.tipo === 'egreso')
      .reduce((acc, m) => {
        acc[m.categoria] = (acc[m.categoria] || 0) + Number(m.monto);
        return acc;
      }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Caja</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {cierre && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Arqueo del turno cerrado</h2>
          <dl className="detalle-grid">
            <div><dt>Total ventas</dt><dd>{formatMoney(cierre.total_ventas)}</dd></div>
            <div><dt>Ingresos de caja</dt><dd style={{ color: '#22c55e' }}>{formatMoney(cierre.mov_ingreso)}</dd></div>
            <div><dt>Gastos / retiros</dt><dd style={{ color: '#f59e0b' }}>{formatMoney(Number(cierre.mov_egreso) + Number(cierre.total_retiros))}</dd></div>
            <div><dt>Efectivo esperado</dt><dd>{formatMoney(cierre.efectivo_esperado)}</dd></div>
            <div><dt>Declarado</dt><dd>{formatMoney(cierre.monto_declarado)}</dd></div>
            <div>
              <dt>Diferencia</dt>
              <dd style={{ color: Number(cierre.diferencia) === 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {formatMoney(cierre.diferencia)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {!turno ? (
        <>
          <div className="card" style={{ maxWidth: 460, marginBottom: 18, textAlign: 'center', padding: '40px 28px', borderStyle: 'dashed' }}>
            <div style={{ fontSize: 40 }}>🔒</div>
            <h2 style={{ margin: '10px 0 4px' }}>No hay turno activo</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: 18 }}>
              Abrí un turno para registrar ventas y movimientos de caja del día.
            </p>
            <form onSubmit={abrir}>
              <div className="field">
                <label>Efectivo inicial en caja ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: 800 }}
                  placeholder="0"
                />
              </div>
              <button className="btn" style={{ width: '100%' }} disabled={ocupado}>
                {ocupado ? <span className="spinner" /> : 'Abrir turno de caja'}
              </button>
            </form>
          </div>

          {historial.length > 0 && (
            <div className="card">
              <h2>Últimos turnos cerrados</h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr><th>Cerrado</th><th>Ventas</th><th>Declarado</th><th>Diferencia</th></tr>
                  </thead>
                  <tbody>
                    {historial.map((t) => (
                      <tr key={t.id}>
                        <td>{formatFecha(t.cerrado_at)}</td>
                        <td>{formatMoney(t.total_ventas)}</td>
                        <td>{formatMoney(t.monto_declarado)}</td>
                        <td style={{ color: Number(t.diferencia) === 0 ? '#22c55e' : '#ef4444' }}>{formatMoney(t.diferencia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* KPIs */}
          <div className="caja-kpis" style={{ marginBottom: 16 }}>
            <div className="caja-kpi">
              <div className="k-lbl" style={{ color: '#7dd3fc' }}>Saldo inicial</div>
              <div className="k-val">{formatMoney(turno.monto_inicial)}</div>
              <div className="k-sub">Apertura {formatFecha(turno.abierto_at)}</div>
            </div>
            <div className="caja-kpi">
              <div className="k-lbl" style={{ color: '#22c55e' }}>Ventas efectivo</div>
              <div className="k-val">{formatMoney(ventasEfectivo)}</div>
              <div className="k-sub">{ventasActivas.length} venta(s) en el turno</div>
            </div>
            <div className="caja-kpi">
              <div className="k-lbl" style={{ color: '#a855f7' }}>Total electrónico</div>
              <div className="k-val">{formatMoney(totalElectronico)}</div>
              <div className="k-sub">Transfer. + tarjetas + QR (ventas y órdenes)</div>
            </div>
            <div className="caja-kpi">
              <div className="k-lbl" style={{ color: '#f59e0b' }}>Efectivo esperado</div>
              <div className="k-val" style={{ color: 'var(--accent)' }}>{formatMoney(esperado)}</div>
              <div className="k-sub">Inicial + ventas + órdenes − gastos</div>
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Desglose + gastos por categoría */}
            <div>
              <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                <div className="pos-card-header">📊 Desglose del turno</div>
                <div className="caja-desglose-row"><span>Saldo inicial</span><strong>{formatMoney(turno.monto_inicial)}</strong></div>
                <div className="caja-desglose-row"><span>+ Ventas efectivo</span><strong style={{ color: '#22c55e' }}>{formatMoney(ventasEfectivo)}</strong></div>
                {pagosOrdenesEfectivo > 0 && (
                  <div className="caja-desglose-row"><span>+ Cobros de órdenes (efectivo)</span><strong style={{ color: '#22c55e' }}>{formatMoney(pagosOrdenesEfectivo)}</strong></div>
                )}
                <div className="caja-desglose-row"><span>+ Ingresos de caja</span><strong style={{ color: '#22c55e' }}>{formatMoney(movIngresos)}</strong></div>
                <div className="caja-desglose-row"><span>− Gastos / retiros</span><strong style={{ color: '#ef4444' }}>{formatMoney(movEgresos)}</strong></div>
                <div className="caja-desglose-total">
                  <span style={{ fontWeight: 700 }}>Efectivo en caja</span>
                  <span className="val">{formatMoney(esperado)}</span>
                </div>
              </div>

              {gastosPorCat.length > 0 && (
                <div className="card" style={{ overflow: 'hidden', padding: 0, marginTop: 12 }}>
                  <div className="pos-card-header">
                    Gastos por categoría <span className="count" style={{ background: '#ef44441a', color: '#ef4444' }}>{formatMoney(movEgresos)}</span>
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {gastosPorCat.map(([cat, monto]) => {
                      const pct = movEgresos > 0 ? Math.round((monto / movEgresos) * 100) : 0;
                      return (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: 3 }}>
                            <span style={{ textTransform: 'capitalize', color: 'var(--text-dim)' }}>{cat}</span>
                            <span style={{ fontWeight: 700, color: '#f59e0b' }}>{formatMoney(monto)} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({pct}%)</span></span>
                          </div>
                          <div className="gasto-bar-track"><div className="gasto-bar-fill" style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Registrar movimiento + cerrar turno */}
            <div>
              <div className="card">
                <h2>Registrar movimiento</h2>
                <form onSubmit={registrarMov}>
                  <div className="seg-toggle">
                    <button
                      type="button"
                      className={`seg-btn ${mov.tipo === 'ingreso' ? 'on-ing' : ''}`}
                      onClick={() => setMov((m) => ({ ...m, tipo: 'ingreso', categoria: CATEGORIAS_MOV.ingreso[0] }))}
                    >
                      ↑ Ingreso
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${mov.tipo === 'egreso' ? 'on-egr' : ''}`}
                      onClick={() => setMov((m) => ({ ...m, tipo: 'egreso', categoria: CATEGORIAS_MOV.egreso[0] }))}
                    >
                      ↓ Egreso / gasto
                    </button>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Monto ($)</label>
                      <input required type="number" min="0.01" step="0.01" value={mov.monto} onChange={(e) => setMov({ ...mov, monto: e.target.value })} style={{ textAlign: 'center', fontWeight: 700 }} />
                    </div>
                    <div className="field">
                      <label>Categoría</label>
                      <select value={mov.categoria} onChange={(e) => setMov({ ...mov, categoria: e.target.value })}>
                        {(mov.tipo === 'ingreso' ? CATEGORIAS_MOV.ingreso : CATEGORIAS_MOV.egreso).map((c) => (
                          <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>Descripción</label>
                    <input required value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} placeholder="Detalle del movimiento" />
                  </div>
                  <button className="btn btn-secondary btn-sm" disabled={ocupado}>Registrar movimiento</button>
                </form>
              </div>

              <div className="card" style={{ marginTop: 12, borderColor: '#ef444455' }}>
                <h2 style={{ color: '#ef4444' }}>Cerrar turno</h2>
                <p style={{ color: 'var(--text-dim)', marginBottom: 12, fontSize: '.88rem' }}>
                  Contá el efectivo y declaralo. El esperado es <strong style={{ color: 'var(--accent)' }}>{formatMoney(esperado)}</strong>.
                </p>
                <form onSubmit={cerrar}>
                  <div className="field">
                    <label>Efectivo contado ($)</label>
                    <input type="number" min="0" step="0.01" value={declarado} onChange={(e) => setDeclarado(e.target.value)} placeholder={String(esperado)} style={{ textAlign: 'center', fontWeight: 700 }} />
                  </div>
                  <button className="btn btn-danger" style={{ width: '100%' }} disabled={ocupado}>
                    {ocupado ? <span className="spinner" /> : 'Cerrar caja'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Movimientos del turno */}
          {movsTodos.length > 0 && (
            <div className="card" style={{ overflow: 'hidden', padding: 0, marginTop: 16 }}>
              <div className="pos-card-header">🔁 Movimientos del turno <span className="count">{movsTodos.length}</span></div>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Hora</th><th>Tipo</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
                  <tbody>
                    {movsTodos.map((m) => (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{hora(m.created_at)}</td>
                        <td>
                          <span className="mp-badge" style={{ color: m.tipo === 'ingreso' ? '#22c55e' : '#ef4444', borderColor: m.tipo === 'ingreso' ? '#22c55e66' : '#ef444466', background: m.tipo === 'ingreso' ? '#22c55e1a' : '#ef44441a', textTransform: 'capitalize' }}>
                            {m.tipo === 'ingreso' ? '↑' : '↓'} {m.categoria}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-dim)' }}>{m.motivo}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: m.tipo === 'ingreso' ? '#22c55e' : '#ef4444' }}>
                          {m.tipo === 'ingreso' ? '+' : '−'}{formatMoney(m.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ventas del turno */}
          <div className="card" style={{ overflow: 'hidden', padding: 0, marginTop: 16 }}>
            <div className="pos-card-header">
              🧾 Ventas del turno <span className="count">{ventasActivas.length}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--text)' }}>{formatMoney(totalVentas)}</span>
            </div>
            {ventasActivas.length === 0 ? (
              <p style={{ padding: 16, color: 'var(--text-dim)' }}>Sin ventas todavía.</p>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>#</th><th>Hora</th><th>Medio</th><th style={{ textAlign: 'right' }}>Monto</th><th></th></tr></thead>
                  <tbody>
                    {ventas.slice(0, 30).map((v) => (
                      <tr key={v.id} style={{ opacity: v.anulada ? 0.5 : 1 }}>
                        <td style={{ fontWeight: 700, color: 'var(--accent)' }}>#{v.numero}</td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{hora(v.created_at)}</td>
                        <td>
                          {v.anulada ? (
                            <span className="mp-badge" style={{ color: '#ef4444', borderColor: '#ef444466', background: '#ef44441a' }}>Anulada</span>
                          ) : (
                            badgeMetodo(v.metodo_pago)
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, textDecoration: v.anulada ? 'line-through' : 'none' }}>{formatMoney(v.total)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {v.anulada ? null : v.facturada_en ? (
                            <span className="mp-badge" style={{ color: '#22c55e', borderColor: '#22c55e66', background: '#22c55e1a' }}>Facturada</span>
                          ) : facturaConectada ? (
                            <button className="chip" disabled={facturandoId === v.id} onClick={() => facturar(v)}>
                              {facturandoId === v.id ? <span className="spinner" /> : 'Facturar'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cobros de órdenes del turno (señas, saldos) */}
          {pagosOrdenes.length > 0 && (
            <div className="card" style={{ overflow: 'hidden', padding: 0, marginTop: 16 }}>
              <div className="pos-card-header">
                🔧 Cobros de órdenes <span className="count">{pagosOrdenes.length}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--text)' }}>
                  {formatMoney(pagosOrdenesEfectivo + pagosOrdenesElectronico)}
                </span>
              </div>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Orden</th><th>Hora</th><th>Tipo</th><th>Medio</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
                  <tbody>
                    {pagosOrdenes.slice(0, 30).map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                          {p.tickets?.numero ? `#${p.tickets.numero}` : '—'}
                          {p.tickets?.nombre && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> · {p.tickets.nombre}</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{hora(p.created_at)}</td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--text-dim)' }}>{p.tipo}</td>
                        <td>{badgeMetodo(p.metodo)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(p.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
