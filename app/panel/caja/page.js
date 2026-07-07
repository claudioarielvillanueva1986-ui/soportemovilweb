'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  supabase,
  METODOS_PAGO,
  formatMoney,
  formatFecha,
} from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

const CATEGORIAS_MOV = {
  egreso: ['insumos', 'servicios', 'sueldos', 'alquiler', 'proveedor', 'otro'],
  ingreso: ['aporte', 'cobro', 'otro'],
};

export default function CajaPage() {
  const [turno, setTurno] = useState(undefined);
  const [ventas, setVentas] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [facturaConectada, setFacturaConectada] = useState(false);
  const [facturandoId, setFacturandoId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [montoInicial, setMontoInicial] = useState('');
  const [retMonto, setRetMonto] = useState('');
  const [retMotivo, setRetMotivo] = useState('');
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
      const [{ data: vs }, { data: rs }, { data: ms }] = await Promise.all([
        supabase
          .from('ventas')
          .select('*')
          .eq('turno_id', t.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('retiros_caja')
          .select('*')
          .eq('turno_id', t.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('movimientos_caja')
          .select('*')
          .eq('turno_id', t.id)
          .order('created_at', { ascending: false }),
      ]);
      setVentas(vs || []);
      setRetiros(rs || []);
      setMovimientos(ms || []);
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

  async function facturar(v) {
    setFacturandoId(v.id);
    setError(null);
    const { data: sesion } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/facturacion/facturar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion?.session?.access_token || ''}`,
        },
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

  async function abrir(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.rpc('abrir_turno', {
      p_monto_inicial: Number(montoInicial),
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setCierre(null);
    setMontoInicial('');
    cargar();
  }

  async function retirar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.rpc('registrar_retiro', {
      p_monto: Number(retMonto),
      p_motivo: retMotivo,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setRetMonto('');
    setRetMotivo('');
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

  if (turno === undefined)
    return <PantallaCarga />;

  const porMetodo = {};
  let totalVentas = 0;
  let ventasEfectivo = 0;
  for (const v of ventas) {
    if (v.anulada) continue;
    porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + Number(v.total);
    totalVentas += Number(v.total);
    if (v.metodo_pago === 'efectivo') ventasEfectivo += Number(v.total);
  }
  const totalRetiros = retiros.reduce((s, r) => s + Number(r.monto), 0);
  const movIngresos = movimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + Number(m.monto), 0);
  const movEgresos = movimientos
    .filter((m) => m.tipo === 'egreso')
    .reduce((s, m) => s + Number(m.monto), 0);
  const esperado = turno
    ? Number(turno.monto_inicial) + ventasEfectivo + movIngresos - totalRetiros - movEgresos
    : 0;

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Caja</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {cierre && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Arqueo del turno cerrado</h2>
          <dl className="detalle-grid">
            <div>
              <dt>Total ventas</dt>
              <dd>{formatMoney(cierre.total_ventas)}</dd>
            </div>
            <div>
              <dt>Retiros</dt>
              <dd>{formatMoney(cierre.total_retiros)}</dd>
            </div>
            {(Number(cierre.mov_ingreso) > 0 || Number(cierre.mov_egreso) > 0) && (
              <>
                <div>
                  <dt>Ingresos de caja</dt>
                  <dd style={{ color: '#22c55e' }}>{formatMoney(cierre.mov_ingreso)}</dd>
                </div>
                <div>
                  <dt>Gastos de caja</dt>
                  <dd style={{ color: '#f59e0b' }}>{formatMoney(cierre.mov_egreso)}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Efectivo esperado</dt>
              <dd>{formatMoney(cierre.efectivo_esperado)}</dd>
            </div>
            <div>
              <dt>Declarado</dt>
              <dd>{formatMoney(cierre.monto_declarado)}</dd>
            </div>
            <div>
              <dt>Diferencia</dt>
              <dd
                style={{
                  color:
                    Number(cierre.diferencia) === 0
                      ? '#22c55e'
                      : '#ef4444',
                  fontWeight: 700,
                }}
              >
                {formatMoney(cierre.diferencia)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {!turno ? (
        <>
          <div className="card" style={{ maxWidth: 460, marginBottom: 18 }}>
            <h2>Abrir turno</h2>
            <form onSubmit={abrir}>
              <div className="field">
                <label>Efectivo inicial ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                />
              </div>
              <button className="btn" disabled={ocupado}>
                {ocupado ? <span className="spinner" /> : 'Abrir caja'}
              </button>
            </form>
          </div>

          {historial.length > 0 && (
            <div className="card">
              <h2>Últimos turnos</h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Cerrado</th>
                      <th>Ventas</th>
                      <th>Retiros</th>
                      <th>Declarado</th>
                      <th>Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((t) => (
                      <tr key={t.id}>
                        <td>{formatFecha(t.cerrado_at)}</td>
                        <td>{formatMoney(t.total_ventas)}</td>
                        <td>{formatMoney(t.total_retiros)}</td>
                        <td>{formatMoney(t.monto_declarado)}</td>
                        <td
                          style={{
                            color:
                              Number(t.diferencia) === 0 ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {formatMoney(t.diferencia)}
                        </td>
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
          <div className="stats">
            <div className="stat">
              <div className="num">{formatMoney(turno.monto_inicial)}</div>
              <div className="lbl">Inicial ({formatFecha(turno.abierto_at)})</div>
            </div>
            <div className="stat">
              <div className="num">{formatMoney(totalVentas)}</div>
              <div className="lbl">Ventas ({ventas.length})</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: '#f59e0b' }}>
                {formatMoney(totalRetiros)}
              </div>
              <div className="lbl">Retiros</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: 'var(--accent)' }}>
                {formatMoney(esperado)}
              </div>
              <div className="lbl">Efectivo esperado</div>
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h2>Ventas por método</h2>
              {Object.keys(porMetodo).length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>Sin ventas todavía.</p>
              ) : (
                <div className="tabla-scroll">
                  <table className="tabla">
                    <tbody>
                      {Object.entries(porMetodo).map(([m, t]) => (
                        <tr key={m}>
                          <td>{METODOS_PAGO[m] || m}</td>
                          <td style={{ textAlign: 'right' }}>{formatMoney(t)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h2 style={{ marginTop: 20 }}>Retiros</h2>
              {retiros.map((r) => (
                <div className="carrito-item" key={r.id}>
                  <div className="info">
                    <div>{r.motivo}</div>
                    <div className="meta">{formatFecha(r.created_at)}</div>
                  </div>
                  <div className="subtotal">−{formatMoney(r.monto)}</div>
                </div>
              ))}
              <form onSubmit={retirar} style={{ marginTop: 10 }}>
                <div className="grid-2">
                  <div className="field">
                    <label>Monto ($)</label>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={retMonto}
                      onChange={(e) => setRetMonto(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Motivo</label>
                    <input
                      required
                      value={retMotivo}
                      onChange={(e) => setRetMotivo(e.target.value)}
                      placeholder="Compra de insumos"
                    />
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" disabled={ocupado}>
                  Registrar retiro
                </button>
              </form>

              <h2 style={{ marginTop: 20 }}>Movimientos de caja</h2>
              {movimientos.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Registrá gastos (insumos, servicios) o ingresos manuales.
                </p>
              ) : (
                movimientos.map((m) => (
                  <div className="carrito-item" key={m.id}>
                    <div className="info">
                      <div>
                        {m.motivo}{' '}
                        <span className="lbl2" style={{ textTransform: 'capitalize' }}>
                          · {m.categoria}
                        </span>
                      </div>
                      <div className="meta">{formatFecha(m.created_at)}</div>
                    </div>
                    <div
                      className="subtotal"
                      style={{ color: m.tipo === 'ingreso' ? '#22c55e' : '#f59e0b' }}
                    >
                      {m.tipo === 'ingreso' ? '+' : '−'}
                      {formatMoney(m.monto)}
                    </div>
                  </div>
                ))
              )}
              <form onSubmit={registrarMov} style={{ marginTop: 10 }}>
                <div className="grid-2">
                  <div className="field">
                    <label>Tipo</label>
                    <select
                      value={mov.tipo}
                      onChange={(e) => {
                        const tipo = e.target.value;
                        setMov((m) => ({
                          ...m,
                          tipo,
                          categoria: (tipo === 'ingreso' ? CATEGORIAS_MOV.ingreso : CATEGORIAS_MOV.egreso)[0],
                        }));
                      }}
                    >
                      <option value="egreso">Gasto / egreso</option>
                      <option value="ingreso">Ingreso</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Categoría</label>
                    <select
                      value={mov.categoria}
                      onChange={(e) => setMov({ ...mov, categoria: e.target.value })}
                    >
                      {(mov.tipo === 'ingreso' ? CATEGORIAS_MOV.ingreso : CATEGORIAS_MOV.egreso).map((c) => (
                        <option key={c} value={c} style={{ textTransform: 'capitalize' }}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Monto ($)</label>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={mov.monto}
                      onChange={(e) => setMov({ ...mov, monto: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Motivo</label>
                    <input
                      required
                      value={mov.motivo}
                      onChange={(e) => setMov({ ...mov, motivo: e.target.value })}
                      placeholder="Detalle del movimiento"
                    />
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" disabled={ocupado}>
                  Registrar movimiento
                </button>
              </form>
            </div>

            <div className="card">
              <h2>Cerrar turno</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
                Contá el efectivo de la caja y declaralo. El sistema calcula la
                diferencia contra lo esperado ({formatMoney(esperado)}).
              </p>
              <form onSubmit={cerrar}>
                <div className="field">
                  <label>Efectivo contado ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={declarado}
                    onChange={(e) => setDeclarado(e.target.value)}
                    placeholder={String(esperado)}
                  />
                </div>
                <button className="btn btn-danger" disabled={ocupado}>
                  {ocupado ? <span className="spinner" /> : 'Cerrar caja'}
                </button>
              </form>

              <h2 style={{ marginTop: 20 }}>Últimas ventas</h2>
              {!facturaConectada && (
                <p className="lbl2" style={{ marginBottom: 8 }}>
                  Conectá Facturá en Configuración para emitir facturas de ARCA.
                </p>
              )}
              {ventas.slice(0, 8).map((v) => (
                <div className="carrito-item" key={v.id}>
                  <div className="info">
                    <div>
                      #{v.numero} · {METODOS_PAGO[v.metodo_pago]}
                      {v.anulada && (
                        <span className="badge" style={{ marginLeft: 6, background: '#ef444422', color: '#ef4444', border: '1px solid #ef444455' }}>
                          Anulada
                        </span>
                      )}
                    </div>
                    <div className="meta">{formatFecha(v.created_at)}</div>
                  </div>
                  {v.facturada_en ? (
                    <span
                      className="badge"
                      style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e55' }}
                      title={v.factura_cae ? `CAE ${v.factura_cae}` : ''}
                    >
                      Facturada
                    </span>
                  ) : (
                    facturaConectada && !v.anulada && (
                      <button
                        className="chip"
                        disabled={facturandoId === v.id}
                        onClick={() => facturar(v)}
                      >
                        {facturandoId === v.id ? <span className="spinner" /> : 'Facturar en ARCA'}
                      </button>
                    )
                  )}
                  <div className="subtotal">{formatMoney(v.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
