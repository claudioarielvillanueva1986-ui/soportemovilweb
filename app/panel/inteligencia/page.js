'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, formatMoney, CATEGORIAS, METODOS_PAGO } from '@/lib/supabase';
import { CargaTarjeta } from '@/components/cargando';

const DIAS_OPCIONES = [
  [30, '30 días'],
  [90, '90 días'],
  [365, '1 año'],
];

async function tokenActual() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token;
}

function ChatIA({ dias, onCerrar }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, enviando]);

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setError(null);
    const nuevos = [...mensajes, { rol: 'usuario', texto: t }];
    setMensajes(nuevos);
    setTexto('');
    setEnviando(true);
    try {
      const token = await tokenActual();
      const res = await fetch('/api/inteligencia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dias, historial: nuevos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consultar al asistente.');
      setMensajes((m) => [...m, { rol: 'asistente', texto: data.texto }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="drawer-overlay" onClick={onCerrar}>
      <aside className="drawer ia-chat" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onCerrar} aria-label="Cerrar chat">
          ✕
        </button>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>🧠 Asistente IA</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: 14 }}>
          Preguntale lo que quieras sobre las ventas del negocio.
        </p>
        <div className="ia-chat-msgs">
          {mensajes.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Ej: "¿Qué categoría me conviene stockear más?", "¿Cómo vengo este mes contra el anterior?"
            </p>
          )}
          {mensajes.map((m, i) => (
            <div key={i} className={`ia-chat-msg ${m.rol}`}>
              {m.texto}
            </div>
          ))}
          {enviando && (
            <div className="ia-chat-msg asistente">
              <span className="spinner" />
            </div>
          )}
          <div ref={finRef} />
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
        <form onSubmit={enviar} className="ia-chat-form">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí tu pregunta..."
            disabled={enviando}
          />
          <button className="btn btn-sm" disabled={enviando || !texto.trim()}>
            Enviar
          </button>
        </form>
      </aside>
    </div>
  );
}

export default function InteligenciaPage() {
  const [dias, setDias] = useState(90);
  const [datos, setDatos] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [chatAbierto, setChatAbierto] = useState(false);

  const cargar = useCallback(async (d) => {
    setCargando(true);
    setError(null);
    try {
      const token = await tokenActual();
      const res = await fetch('/api/inteligencia/analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dias: d }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo generar el análisis.');
      setDatos(data.datos);
      setAnalisis(data.analisis);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(dias);
  }, [dias, cargar]);

  const maxCategoria = datos?.top_categorias?.[0]?.total || 1;
  const maxMarca = datos?.equipos_por_marca?.[0]?.cantidad || 1;
  const proyeccionMes = datos ? datos.proyeccion.promedio_diario * datos.proyeccion.dias_mes : 0;

  return (
    <main>
      <div className="ia-hero card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.6rem' }}>🧠</span>
          <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Inteligencia de Ventas</h1>
          <span className="ia-badge">IA</span>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 14 }}>
          Análisis automático de los últimos {dias} días · Recomendaciones estratégicas en tiempo real
        </p>
        <button className="btn ia-btn-chat" onClick={() => setChatAbierto(true)}>
          ✨ Chatear con el Asistente IA →
        </button>
      </div>

      <div className="filters" style={{ margin: '16px 0' }}>
        {DIAS_OPCIONES.map(([d, label]) => (
          <button key={d} className={`chip ${dias === d ? 'active' : ''}`} onClick={() => setDias(d)}>
            {label}
          </button>
        ))}
        <button className="chip" onClick={() => cargar(dias)} disabled={cargando} title="Volver a analizar">
          🔄 Actualizar
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando && !datos && <CargaTarjeta lineas={6} />}

      {datos && (
        <>
          <div className="stats kpis">
            <div className="stat">
              <div className="lbl">Ingresos {dias}D</div>
              <div className="num kpi-num">{formatMoney(datos.ingresos.total)}</div>
              <div className="lbl2">
                {datos.ingresos.variacion_pct != null
                  ? `${datos.ingresos.variacion_pct >= 0 ? '↑' : '↓'} ${Math.abs(datos.ingresos.variacion_pct)}% vs. período ant.`
                  : `${datos.ingresos.cantidad} ventas`}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">Ticket promedio</div>
              <div className="num kpi-num">{formatMoney(datos.ticket_promedio)}</div>
              <div className="lbl2">por transacción</div>
            </div>
            <div className="stat">
              <div className="lbl">Productos activos</div>
              <div className="num kpi-num">{datos.productos_activos}</div>
              <div className="lbl2">en catálogo</div>
            </div>
            <div className="stat">
              <div className="lbl">Alertas activas</div>
              <div className="num kpi-num" style={{ color: datos.alertas_activas > 0 ? 'var(--warn)' : 'var(--ok)' }}>
                {datos.alertas_activas}
              </div>
              <div className="lbl2">requieren atención</div>
            </div>
          </div>

          {cargando && !analisis && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ color: 'var(--text-dim)' }}>
                <span className="spinner" style={{ marginRight: 8 }} />
                La IA está analizando los datos del negocio...
              </p>
            </div>
          )}

          {analisis && (
            <div className="card ia-estrategias">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>💡 Estrategias recomendadas</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginBottom: 14 }}>{analisis.resumen}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(analisis.estrategias || []).map((e, i) => (
                  <div key={i} className="ia-estrategia-item">
                    <span style={{ fontSize: '1.2rem' }}>{e.icono}</span>
                    <div>
                      <strong>{e.titulo}</strong>
                      <p style={{ margin: '2px 0 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>{e.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
              {analisis.alerta && (
                <div className="alert alert-error" style={{ marginTop: 14 }}>
                  ⚠️ {analisis.alerta}
                </div>
              )}
            </div>
          )}

          {analisis?.categoria_recomendada?.categoria && (
            <div className="card" style={{ marginTop: 16, borderColor: 'var(--ok)' }}>
              <h2>📈 Categoría recomendada para invertir</h2>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--ok)', margin: '6px 0' }}>
                {CATEGORIAS[analisis.categoria_recomendada.categoria] || analisis.categoria_recomendada.categoria}
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>{analisis.categoria_recomendada.motivo}</p>
            </div>
          )}

          <div className="grid-2" style={{ alignItems: 'start', marginTop: 16 }}>
            <div className="card">
              <h2>Ventas por categoría</h2>
              {(datos.top_categorias || []).length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>Sin datos en el período.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {datos.top_categorias.map((c) => (
                    <div key={c.categoria}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                        <span>{CATEGORIAS[c.categoria] || c.categoria}</span>
                        <strong>{formatMoney(c.total)}</strong>
                      </div>
                      <div className="barra-progreso">
                        <div
                          className="barra-progreso-fill"
                          style={{ width: `${Math.max(4, (c.total / maxCategoria) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Equipos por marca</h2>
              {(datos.equipos_por_marca || []).length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>Sin órdenes en el período.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {datos.equipos_por_marca.map((e) => (
                    <div key={e.marca}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                        <span>{e.marca}</span>
                        <strong>{e.cantidad} equipos</strong>
                      </div>
                      <div className="barra-progreso">
                        <div
                          className="barra-progreso-fill"
                          style={{ width: `${Math.max(4, (e.cantidad / maxMarca) * 100)}%`, background: 'var(--accent)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h2>Medios de pago</h2>
            {Object.keys(datos.por_metodo || {}).length === 0 ? (
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

          <div className="card" style={{ marginTop: 16 }}>
            <h2>Proyección del mes</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 10 }}>
              Día {datos.proyeccion.dia_actual} de {datos.proyeccion.dias_mes}
            </p>
            <div className="stat-grande">{formatMoney(proyeccionMes)}</div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>proyección a fin de mes, según el promedio diario</p>
          </div>
        </>
      )}

      {chatAbierto && <ChatIA dias={dias} onCerrar={() => setChatAbierto(false)} />}
    </main>
  );
}
