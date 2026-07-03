'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, METODOS_PAGO, formatMoney } from '@/lib/supabase';

function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  ['hoy', 'Hoy', 0],
  ['7d', 'Últimos 7 días', 6],
  ['30d', 'Últimos 30 días', 29],
  ['90d', 'Últimos 90 días', 89],
];

export default function ReportesPage() {
  const [preset, setPreset] = useState('7d');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (dias) => {
    setError(null);
    setDatos(null);
    const hasta = new Date();
    const desde = new Date(Date.now() - dias * 86400000);
    const { data, error: err } = await supabase.rpc('reporte_ventas', {
      p_desde: fechaISO(desde),
      p_hasta: fechaISO(hasta),
    });
    if (err) setError(err.message);
    else setDatos(data);
  }, []);

  useEffect(() => {
    const p = PRESETS.find(([k]) => k === preset);
    cargar(p[2]);
  }, [preset, cargar]);

  const maxDia = datos?.por_dia?.length
    ? Math.max(...datos.por_dia.map((d) => Number(d.total)))
    : 0;

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Reportes</h1>

      <div className="filters">
        {PRESETS.map(([k, label]) => (
          <button
            key={k}
            className={`chip ${preset === k ? 'active' : ''}`}
            onClick={() => setPreset(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!datos && !error && (
        <p style={{ padding: 30, textAlign: 'center' }}>
          <span className="spinner" />
        </p>
      )}

      {datos && (
        <>
          <div className="stats kpis">
            <div className="stat">
              <div className="lbl">Facturación</div>
              <div className="num kpi-num">{formatMoney(datos.total)}</div>
              <div className="lbl2">{datos.cantidad} ventas</div>
            </div>
            <div className="stat">
              <div className="lbl">Ticket promedio</div>
              <div className="num kpi-num">{formatMoney(datos.promedio)}</div>
              <div className="lbl2">por venta</div>
            </div>
            <div className="stat">
              <div className="lbl">Margen bruto</div>
              <div className="num kpi-num" style={{ color: 'var(--accent)' }}>
                {formatMoney(datos.margen)}
              </div>
              <div className="lbl2">precio − costo de productos</div>
            </div>
          </div>

          {datos.por_dia.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2>Ventas por día</h2>
              <div className="grafico-barras">
                {datos.por_dia.map((d) => (
                  <div className="barra-col" key={d.dia} title={`${d.dia}: ${formatMoney(d.total)}`}>
                    <div
                      className="barra"
                      style={{
                        height: `${maxDia ? Math.max(4, (Number(d.total) / maxDia) * 120) : 4}px`,
                      }}
                    />
                    <span className="barra-lbl">
                      {d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h2>Por método de pago</h2>
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
              <h2>Top productos</h2>
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
          </div>
        </>
      )}
    </main>
  );
}
