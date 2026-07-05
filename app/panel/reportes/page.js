'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, METODOS_PAGO, ESTADOS, formatMoney } from '@/lib/supabase';
import { CargaTarjeta } from '@/components/cargando';

function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  ['7d', 'Últimos 7 días', () => new Date(Date.now() - 6 * 86400000), 'dia'],
  ['30d', 'Últimos 30 días', () => new Date(Date.now() - 29 * 86400000), 'dia'],
  ['mes', 'Este mes', () => new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'dia'],
  ['anio', 'Este año', () => new Date(new Date().getFullYear(), 0, 1), 'mes'],
  ['todo', 'Todo el historial', () => new Date(2000, 0, 1), 'mes'],
];

const AGRUPAR = [
  ['dia', 'Por día'],
  ['mes', 'Por mes'],
  ['anio', 'Por año'],
];

function etiquetaPeriodo(per, agrupar) {
  if (agrupar === 'dia') return `${per.slice(8, 10)}/${per.slice(5, 7)}`;
  if (agrupar === 'mes') return `${per.slice(5, 7)}/${per.slice(2, 4)}`;
  return per;
}

function Barras({ serie, agrupar, campo, formato }) {
  const max = serie.length ? Math.max(...serie.map((d) => Number(d[campo]))) : 0;
  return (
    <div className="grafico-barras">
      {serie.map((d) => (
        <div
          className="barra-col"
          key={d.periodo}
          title={`${d.periodo}: ${formato(d[campo])}${d.cantidad != null && campo !== 'cantidad' ? ` (${d.cantidad} ventas)` : ''}`}
        >
          <div
            className="barra"
            style={{ height: `${max ? Math.max(4, (Number(d[campo]) / max) * 120) : 4}px` }}
          />
          <span className="barra-lbl">{etiquetaPeriodo(d.periodo, agrupar)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportesPage() {
  const [preset, setPreset] = useState('30d');
  const [agrupar, setAgrupar] = useState('dia');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (presetKey, agruparKey) => {
    setError(null);
    setDatos(null);
    const p = PRESETS.find(([k]) => k === presetKey);
    const { data, error: err } = await supabase.rpc('reporte_historial', {
      p_desde: fechaISO(p[2]()),
      p_hasta: fechaISO(new Date()),
      p_agrupar: agruparKey,
    });
    if (err) setError(err.message);
    else setDatos(data);
  }, []);

  useEffect(() => {
    cargar(preset, agrupar);
  }, [preset, agrupar, cargar]);

  function elegirPreset(k) {
    const p = PRESETS.find(([kk]) => kk === k);
    setPreset(k);
    setAgrupar(p[3]);
  }

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Reportes</h1>

      <div className="filters">
        {PRESETS.map(([k, label]) => (
          <button
            key={k}
            className={`chip ${preset === k ? 'active' : ''}`}
            onClick={() => elegirPreset(k)}
          >
            {label}
          </button>
        ))}
        <span style={{ width: 12 }} />
        {AGRUPAR.map(([k, label]) => (
          <button
            key={k}
            className={`chip ${agrupar === k ? 'active' : ''}`}
            onClick={() => setAgrupar(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!datos && !error && (
        <>
          <div className="stats">
            {[0, 1, 2, 3].map((i) => (
              <div className="stat" key={i}>
                <div className="sk-line" style={{ width: '55%' }} />
                <div className="sk-line" style={{ width: '75%', height: 20, marginTop: 10 }} />
              </div>
            ))}
          </div>
          <CargaTarjeta lineas={4} />
        </>
      )}

      {datos && (
        <>
          <div className="stats kpis">
            <div className="stat">
              <div className="lbl">Facturación</div>
              <div className="num kpi-num">{formatMoney(datos.ventas_total)}</div>
              <div className="lbl2">{datos.ventas_cantidad} ventas</div>
            </div>
            <div className="stat">
              <div className="lbl">Ticket promedio</div>
              <div className="num kpi-num">{formatMoney(datos.ventas_promedio)}</div>
              <div className="lbl2">por venta</div>
            </div>
            <div className="stat">
              <div className="lbl">Órdenes</div>
              <div className="num kpi-num" style={{ color: 'var(--accent)' }}>
                {datos.ordenes_total}
              </div>
              <div className="lbl2">reparaciones ingresadas</div>
            </div>
            <div className="stat">
              <div className="lbl">Margen bruto</div>
              <div className="num kpi-num">{formatMoney(datos.margen)}</div>
              <div className="lbl2">solo ventas con producto vinculado</div>
            </div>
          </div>

          {datos.serie_ventas.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2>Facturación ({AGRUPAR.find(([k]) => k === agrupar)[1].toLowerCase()})</h2>
              <Barras serie={datos.serie_ventas} agrupar={agrupar} campo="total" formato={formatMoney} />
            </div>
          )}

          {datos.serie_ordenes.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2>Órdenes ingresadas ({AGRUPAR.find(([k]) => k === agrupar)[1].toLowerCase()})</h2>
              <Barras serie={datos.serie_ordenes} agrupar={agrupar} campo="cantidad" formato={(v) => `${v} órdenes`} />
            </div>
          )}

          <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
            <div className="card">
              <h2>Ventas por método de pago</h2>
              {Object.keys(datos.por_metodo).length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>Sin ventas en el período.</p>
              ) : (
                <div className="tabla-scroll">
                  <table className="tabla">
                    <tbody>
                      {Object.entries(datos.por_metodo)
                        .sort((a, b) => b[1] - a[1])
                        .map(([m, t]) => (
                          <tr key={m}>
                            <td>{METODOS_PAGO[m] || m}</td>
                            <td style={{ textAlign: 'right' }}>{formatMoney(t)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h2>Órdenes por estado</h2>
              {Object.keys(datos.ordenes_por_estado).length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>Sin órdenes en el período.</p>
              ) : (
                <div className="tabla-scroll">
                  <table className="tabla">
                    <tbody>
                      {Object.entries(datos.ordenes_por_estado)
                        .sort((a, b) => b[1] - a[1])
                        .map(([e, c]) => (
                          <tr key={e}>
                            <td>{ESTADOS[e]?.label || e}</td>
                            <td style={{ textAlign: 'right' }}>{c}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Top productos vendidos</h2>
            {datos.top_productos.length === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>Sin datos en el período.</p>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Un.</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.top_productos.map((p) => (
                      <tr key={p.nombre}>
                        <td>{p.nombre}</td>
                        <td>{p.unidades}</td>
                        <td style={{ textAlign: 'right' }}>{formatMoney(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
