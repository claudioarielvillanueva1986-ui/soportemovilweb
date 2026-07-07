'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

const AV_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#22c55e', '#8b5cf6', '#14b8a6', '#ef4444'];
function avColor(s) {
  const n = String(s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AV_COLORS[n % AV_COLORS.length];
}
function iniciales(nombre, tel) {
  if (nombre) {
    return nombre.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }
  return String(tel || '?').slice(-2);
}
function hora(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function WhatsAppPage() {
  const { esDueno } = usePerfil();
  const [negocio, setNegocio] = useState(undefined);
  const [convs, setConvs] = useState([]);
  const [activa, setActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [bloqueados, setBloqueados] = useState(new Set());
  const [respuestas, setRespuestas] = useState([]);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [rrAbierto, setRrAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [cfgAbierta, setCfgAbierta] = useState(false);
  const finRef = useRef(null);

  const cargarConvs = useCallback(async () => {
    const { data } = await supabase.from('wa_conversaciones').select('*').order('ultima_at', { ascending: false });
    setConvs(data || []);
  }, []);

  const cargarBloqueados = useCallback(async () => {
    const { data } = await supabase.from('wa_bloqueados').select('wa_telefono');
    setBloqueados(new Set((data || []).map((b) => b.wa_telefono)));
  }, []);

  useEffect(() => {
    supabase.from('negocios').select('id, bot_ia').maybeSingle().then(({ data }) => setNegocio(data || null));
    cargarConvs();
    cargarBloqueados();
    supabase.from('wa_respuestas_rapidas').select('*').order('orden').then(({ data }) => setRespuestas(data || []));
  }, [cargarConvs, cargarBloqueados]);

  const cargarMensajes = useCallback(async (conv) => {
    const { data } = await supabase.from('wa_mensajes').select('*').eq('conversacion_id', conv.id).order('created_at');
    setMensajes(data || []);
    setTimeout(() => finRef.current?.scrollIntoView({ block: 'end' }), 30);
  }, []);

  async function abrir(conv) {
    setActiva(conv);
    setError(null);
    setRrAbierto(false);
    await cargarMensajes(conv);
    if (conv.no_leidos > 0) {
      await supabase.rpc('wa_marcar_leido', { p_id: conv.id });
      cargarConvs();
    }
  }

  useEffect(() => {
    if (!activa) return;
    const t = setInterval(() => {
      cargarMensajes(activa);
      cargarConvs();
    }, 10000);
    return () => clearInterval(t);
  }, [activa, cargarMensajes, cargarConvs]);

  async function cambiarModo(modo) {
    if (!activa) return;
    await supabase.rpc('wa_tomar', { p_id: activa.id, p_modo: modo });
    setActiva({ ...activa, modo });
    cargarConvs();
  }

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim() || !activa) return;
    setEnviando(true);
    setError(null);
    const { data: sesion } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token || ''}` },
        body: JSON.stringify({ conversacion_id: activa.id, texto: texto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'No se pudo enviar');
      else {
        setTexto('');
        setActiva({ ...activa, modo: 'humano' });
        await cargarMensajes(activa);
        cargarConvs();
      }
    } catch (e2) {
      setError(e2.message);
    }
    setEnviando(false);
  }

  async function bloquear() {
    if (!activa) return;
    await supabase.from('wa_bloqueados').insert({ wa_telefono: activa.wa_telefono });
    cargarBloqueados();
  }
  async function desbloquear() {
    if (!activa) return;
    await supabase.from('wa_bloqueados').delete().eq('wa_telefono', activa.wa_telefono);
    cargarBloqueados();
  }

  if (negocio === undefined) return <PantallaCarga />;

  if (!negocio?.bot_ia) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
          <h2>WhatsApp con IA (PACHE)</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            El asistente de WhatsApp con IA no está habilitado para este negocio.
          </p>
        </div>
      </main>
    );
  }

  const q = busqueda.toLowerCase().trim();
  const visibles = convs.filter((c) => {
    if (filtro === 'noleidos' && !(c.no_leidos > 0)) return false;
    if (filtro === 'bot' && c.modo !== 'bot') return false;
    if (filtro === 'humano' && c.modo !== 'humano') return false;
    if (q && !(c.nombre || '').toLowerCase().includes(q) && !c.wa_telefono.includes(q)) return false;
    return true;
  });
  const totalNoLeidos = convs.reduce((s, c) => s + (c.no_leidos || 0), 0);
  const activaBloqueada = activa && bloqueados.has(activa.wa_telefono);

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: '1.5rem' }}>WhatsApp</h1>
        {esDueno && (
          <button className="btn btn-secondary btn-sm" onClick={() => setCfgAbierta((v) => !v)}>
            {cfgAbierta ? 'Cerrar configuración' : 'Configurar bot'}
          </button>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {cfgAbierta && <ConfigBot onCerrar={() => setCfgAbierta(false)} />}

      <div className="wc">
        {/* Lista */}
        <aside className={`wc-side ${activa ? 'oculto' : ''}`}>
          <div className="wc-head">
            <div className="wc-head-top">
              <div className="wc-head-logo">💬</div>
              <div className="wc-head-title">Chats</div>
              <div className="wc-head-badge"><span className="wc-head-dot" />{totalNoLeidos} sin leer</div>
            </div>
            <input className="wc-search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o número…" />
          </div>
          <div className="wc-filters">
            {[['todos', 'Todos'], ['noleidos', 'No leídos'], ['bot', '🤖 Bot'], ['humano', '👤 Humano']].map(([k, l]) => (
              <button key={k} className={`wc-filter ${filtro === k ? 'active' : ''}`} onClick={() => setFiltro(k)}>{l}</button>
            ))}
          </div>
          <div className="wc-list">
            {visibles.length === 0 && (
              <p style={{ color: 'var(--text-dim)', padding: 14, fontSize: '.85rem' }}>
                {convs.length === 0 ? 'Cuando un cliente escriba al WhatsApp del taller, aparece acá.' : 'Sin chats con ese filtro.'}
              </p>
            )}
            {visibles.map((c) => (
              <button key={c.id} className={`wc-item ${activa?.id === c.id ? 'active' : ''}`} onClick={() => abrir(c)}>
                <span className="wc-av" style={{ background: avColor(c.nombre || c.wa_telefono) }}>{iniciales(c.nombre, c.wa_telefono)}</span>
                <div className="wc-item-info">
                  <div className="wc-item-name">
                    {c.nombre || c.wa_telefono}
                    {bloqueados.has(c.wa_telefono) && ' 🚫'}
                  </div>
                  <div className="wc-item-prev">{c.modo === 'humano' ? '👤 ' : ''}{c.ultimo_texto || ''}</div>
                </div>
                <div className="wc-item-meta">
                  <span className="wc-item-time">{hora(c.ultima_at)}</span>
                  {c.no_leidos > 0 && <span className="wc-item-badge">{c.no_leidos}</span>}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat */}
        <section className={`wc-main ${activa ? '' : 'oculto'}`}>
          {!activa ? (
            <div className="wc-empty">
              <div style={{ fontSize: 54 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Elegí una conversación</div>
              <div style={{ fontSize: '.85rem', maxWidth: 280, textAlign: 'center' }}>
                PACHE responde solo en modo bot. Tomá la charla para responder vos.
              </div>
            </div>
          ) : (
            <>
              <div className="wc-chat-head">
                <button className="wc-back" onClick={() => setActiva(null)}>‹</button>
                <span className="wc-av" style={{ background: avColor(activa.nombre || activa.wa_telefono), width: 38, height: 38, fontSize: 13 }}>
                  {iniciales(activa.nombre, activa.wa_telefono)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wc-chat-name">{activa.nombre || activa.wa_telefono}</div>
                  <div className="wc-chat-sub">{activa.wa_telefono} · {activa.modo === 'bot' ? '🤖 Bot activo' : '👤 Atención humana'}</div>
                </div>
                {activa.modo === 'bot' ? (
                  <button className="wc-hbtn" onClick={() => cambiarModo('humano')}>Tomar yo</button>
                ) : (
                  <button className="wc-hbtn" onClick={() => cambiarModo('bot')}>Devolver al bot</button>
                )}
                {esDueno && (
                  activaBloqueada
                    ? <button className="wc-hbtn" onClick={desbloquear}>Desbloquear</button>
                    : <button className="wc-hbtn" onClick={bloquear}>Bloquear</button>
                )}
              </div>

              {activa.modo === 'humano' && (
                <div className="wc-esc">⚠️ Estás atendiendo esta conversación. El bot no responde hasta que la devuelvas.</div>
              )}

              <div className="wc-msgs">
                {mensajes.map((m) => {
                  const sent = m.direccion === 'out';
                  const cls = m.autor === 'bot' ? 'bot' : m.autor === 'operador' ? 'operador' : 'cliente';
                  return (
                    <div key={m.id} className={`wc-bwrap ${sent ? 'sent' : 'recv'}`}>
                      <div className={`wc-bubble ${cls}`}>
                        {m.autor === 'bot' && <span className="wc-blabel">🤖 PACHE</span>}
                        {m.autor === 'operador' && <span className="wc-blabel">👤 Vos</span>}
                        {m.texto}
                        <div className="wc-btime">{hora(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={finRef} />
              </div>

              {activaBloqueada && (
                <div className="wc-blocked">Este número está bloqueado. El bot no le responde.</div>
              )}

              {rrAbierto && respuestas.length > 0 && (
                <div className="wc-rr">
                  {respuestas.map((r) => (
                    <button key={r.id} className="wc-rr-chip" onClick={() => { setTexto((t) => (t ? t + ' ' : '') + r.texto); setRrAbierto(false); }} title={r.texto}>
                      {r.titulo}
                    </button>
                  ))}
                </div>
              )}

              <form className="wc-inbar" onSubmit={enviar}>
                {respuestas.length > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRrAbierto((v) => !v)} title="Respuestas rápidas">⚡</button>
                )}
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribir mensaje…" />
                <button className="wc-sendbtn" disabled={enviando || !texto.trim()}>
                  {enviando ? '…' : '➤'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ConfigBot({ onCerrar }) {
  const [form, setForm] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.from('wa_config').select('*').maybeSingle().then(({ data }) =>
      setForm({
        phone_number_id: data?.phone_number_id || '',
        bot_activo: data?.bot_activo ?? true,
        saludo: data?.saludo || '',
        prompt_extra: data?.prompt_extra || '',
      })
    );
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    const { data: neg } = await supabase.from('negocios').select('id').maybeSingle();
    const { error } = await supabase.from('wa_config').upsert(
      {
        negocio_id: neg.id,
        phone_number_id: form.phone_number_id.trim() || null,
        bot_activo: form.bot_activo,
        saludo: form.saludo || null,
        prompt_extra: form.prompt_extra || null,
        activo: true,
      },
      { onConflict: 'negocio_id' }
    );
    setGuardando(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else { setAviso({ tipo: 'ok', texto: 'Configuración guardada.' }); onCerrar?.(); }
  }

  if (!form) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>Configuración del bot</h2>
      {aviso && <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{aviso.texto}</div>}
      <form onSubmit={guardar}>
        <div className="field">
          <label>Phone Number ID (de Meta / WhatsApp Cloud API)</label>
          <input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} placeholder="Ej: 123456789012345" />
          <small style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>Meta → WhatsApp → API Setup. Identifica el número que envía/recibe.</small>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
          <input type="checkbox" checked={form.bot_activo} onChange={(e) => setForm({ ...form, bot_activo: e.target.checked })} style={{ width: 'auto' }} />
          Bot con IA activado (si lo apagás, los mensajes llegan pero no se responden solos)
        </label>
        <div className="field">
          <label>Presentación / tono del asistente</label>
          <textarea value={form.saludo} onChange={(e) => setForm({ ...form, saludo: e.target.value })} style={{ minHeight: 56 }} />
        </div>
        <div className="field">
          <label>Instrucciones extra: horarios, precios, promos</label>
          <textarea value={form.prompt_extra} onChange={(e) => setForm({ ...form, prompt_extra: e.target.value })} style={{ minHeight: 56 }} />
        </div>
        <button className="btn" disabled={guardando}>{guardando ? <span className="spinner" /> : 'Guardar configuración'}</button>
      </form>
    </div>
  );
}
