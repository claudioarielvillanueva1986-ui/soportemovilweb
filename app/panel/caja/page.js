'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  supabase,
  METODOS_PAGO,
  formatMoney,
  formatFecha,
} from '@/lib/supabase';

export default function CajaPage() {
  const [turno, setTurno] = useState(undefined);
  const [ventas, setVentas] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [facturas, setFacturas] = useState({});
  const [historial, setHistorial] = useState([]);
  const [montoInicial, setMontoInicial] = useState('');
  const [retMonto, setRetMonto] = useState('');
  const [retMotivo, setRetMotivo] = useState('');
  const [declarado, setDeclarado] = useState('');
  const [cierre, setCierre] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data: resumen } = await supabase.rpc('resumen_panel');
    const t = resumen?.turno || null;
    setTurno(t);
    if (t) {
      const [{ data: vs }, { data: rs }] = await Promise.all([
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
      ]);
      setVentas(vs || []);
      setRetiros(rs || []);
      if (vs?.length) {
        const { data: fs } = await supabase
          .from('facturas')
          .select('venta_id, estado')
          .in('venta_id', vs.map((v) => v.id));
        setFacturas(
          Object.fromEntries((fs || []).map((f) => [f.venta_id, f.estado]))
        );
      } else {
        setFacturas({});
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
  }, [cargar]);

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
    return (
      <main style={{ textAlign: 'center', padding: 60 }}>
        <span className="spinner" />
      </main>
    );

  const porMetodo = {};
  let totalVentas = 0;
  let ventasEfectivo = 0;
  for (const v of ventas) {
    porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + Number(v.total);
    totalVentas += Number(v.total);
    if (v.metodo_pago === 'efectivo') ventasEfectivo += Number(v.total);
  }
  const totalRetiros = retiros.reduce((s, r) => s + Number(r.monto), 0);
  const esperado = turno
    ? Number(turno.monto_inicial) + ventasEfectivo - totalRetiros
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
              {ventas.slice(0, 8).map((v) => (
                <div className="carrito-item" key={v.id}>
                  <div className="info">
                    <div>
                      #{v.numero} · {METODOS_PAGO[v.metodo_pago]}
                    </div>
                    <div className="meta">{formatFecha(v.created_at)}</div>
                  </div>
                  {facturas[v.id] ? (
                    <span
                      className="badge"
                      style={{
                        background: '#22c55e22',
                        color: facturas[v.id] === 'emitida' ? '#22c55e' : '#f59e0b',
                        border: '1px solid #22c55e55',
                      }}
                    >
                      {facturas[v.id]}
                    </span>
                  ) : (
                    <button
                      className="chip"
                      onClick={async () => {
                        const { error: err } = await supabase
                          .from('facturas')
                          .insert({ venta_id: v.id });
                        if (err) setError(err.message);
                        else cargar();
                      }}
                    >
                      Facturar
                    </button>
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
