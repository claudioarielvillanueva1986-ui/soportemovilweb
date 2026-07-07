'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, formatFecha } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

function horaCorta(iso) {
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
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [cfgAbierta, setCfgAbierta] = useState(false);
  const finRef = useRef(null);

  const cargarConvs = useCallback(async () => {
    const { data } = await supabase
      .from('wa_conversaciones')
      .select('*')
      .order('ultima_at', { ascending: false });
    setConvs(data || []);
  }, []);

  useEffect(() => {
    supabase
      .from('negocios')
      .select('id, bot_ia')
      .maybeSingle()
      .then(({ data }) => setNegocio(data || null));
    cargarConvs();
  }, [cargarConvs]);

  const cargarMensajes = useCallback(async (conv) => {
    const { data } = await supabase
      .from('wa_mensajes')
      .select('*')
      .eq('conversacion_id', conv.id)
      .order('created_at');
    setMensajes(data || []);
    setTimeout(() => finRef.current?.scrollIntoView({ block: 'end' }), 30);
  }, []);

  async function abrir(conv) {
    setActiva(conv);
    setError(null);
    await cargarMensajes(conv);
    if (conv.no_leidos > 0) {
      await supabase.rpc('wa_marcar_leido', { p_id: conv.id });
      cargarConvs();
    }
  }

  // refresco de la conversación abierta cada 10s
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion?.session?.access_token || ''}`,
        },
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

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '6px 0 14px' }}>
        <h1 style={{ fontSize: '1.5rem' }}>WhatsApp</h1>
        {esDueno && (
          <button className="btn btn-secondary btn-sm" onClick={() => setCfgAbierta((v) => !v)}>
            {cfgAbierta ? 'Cerrar configuración' : 'Configurar bot'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {cfgAbierta && <ConfigBot onCerrar={() => setCfgAbierta(false)} />}

      <div className="wa-shell">
        <aside className="wa-lista">
          {convs.length === 0 && (
            <p style={{ color: 'var(--text-dim)', padding: 12, fontSize: '0.88rem' }}>
              Todavía no hay conversaciones. Cuando un cliente escriba al WhatsApp del taller, aparecen acá.
            </p>
          )}
          {convs.map((c) => (
            <button
              key={c.id}
              className={`wa-conv ${activa?.id === c.id ? 'active' : ''}`}
              onClick={() => abrir(c)}
            >
              <div className="wa-conv-top">
                <strong>{c.nombre || c.wa_telefono}</strong>
                <span className="meta">{horaCorta(c.ultima_at)}</span>
              </div>
              <div className="wa-conv-sub">
                <span className="wa-ultimo">{c.ultimo_texto || ''}</span>
                {c.no_leidos > 0 && <span className="wa-badge">{c.no_leidos}</span>}
              </div>
              <span className={`pill wa-modo ${c.modo}`}>{c.modo === 'bot' ? '🤖 Bot' : '👤 Humano'}</span>
            </button>
          ))}
        </aside>

        <section className="wa-hilo">
          {!activa ? (
            <div className="wa-vacio">Elegí una conversación para ver los mensajes.</div>
          ) : (
            <>
              <div className="wa-hilo-head">
                <div>
                  <strong>{activa.nombre || activa.wa_telefono}</strong>
                  <div className="meta">{activa.wa_telefono}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {activa.modo === 'bot' ? (
                    <button className="btn btn-sm" onClick={() => cambiarModo('humano')}>Tomar yo</button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => cambiarModo('bot')}>Devolver al bot</button>
                  )}
                </div>
              </div>

              <div className="wa-mensajes">
                {mensajes.map((m) => (
                  <div key={m.id} className={`wa-msg ${m.direccion === 'in' ? 'in' : 'out'}`}>
                    <div className="wa-msg-texto">{m.texto}</div>
                    <div className="wa-msg-meta">
                      {m.autor === 'bot' ? '🤖 ' : m.autor === 'operador' ? '👤 ' : ''}
                      {horaCorta(m.created_at)}
                    </div>
                  </div>
                ))}
                <div ref={finRef} />
              </div>

              <form className="wa-responder" onSubmit={enviar}>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={activa.modo === 'bot' ? 'Escribir (tomás la conversación)…' : 'Escribir mensaje…'}
                />
                <button className="btn" disabled={enviando || !texto.trim()}>
                  {enviando ? <span className="spinner" /> : 'Enviar'}
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
    supabase
      .from('wa_config')
      .select('*')
      .maybeSingle()
      .then(({ data }) =>
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
    else {
      setAviso({ tipo: 'ok', texto: 'Configuración guardada.' });
      onCerrar?.();
    }
  }

  if (!form) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>Configuración del bot</h2>
      {aviso && <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{aviso.texto}</div>}
      <form onSubmit={guardar}>
        <div className="field">
          <label>Phone Number ID (de Meta / WhatsApp Cloud API)</label>
          <input
            value={form.phone_number_id}
            onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
            placeholder="Ej: 123456789012345"
          />
          <small style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>
            Lo encontrás en Meta → WhatsApp → API Setup. Es el identificador del número que envía/recibe.
          </small>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
          <input
            type="checkbox"
            checked={form.bot_activo}
            onChange={(e) => setForm({ ...form, bot_activo: e.target.checked })}
            style={{ width: 'auto' }}
          />
          Bot con IA activado (si lo apagás, los mensajes llegan pero no se responden solos)
        </label>
        <div className="field">
          <label>Presentación / tono del asistente</label>
          <textarea
            value={form.saludo}
            onChange={(e) => setForm({ ...form, saludo: e.target.value })}
            style={{ minHeight: 56 }}
            placeholder="Soy el asistente de tu taller. Puedo ayudarte con el estado de tu reparación…"
          />
        </div>
        <div className="field">
          <label>Instrucciones extra (opcional): horarios, precios fijos, promos</label>
          <textarea
            value={form.prompt_extra}
            onChange={(e) => setForm({ ...form, prompt_extra: e.target.value })}
            style={{ minHeight: 56 }}
            placeholder="Atendemos de 9 a 18. Cambio de pantalla desde $X. Diagnóstico sin cargo."
          />
        </div>
        <button className="btn" disabled={guardando}>
          {guardando ? <span className="spinner" /> : 'Guardar configuración'}
        </button>
      </form>
    </div>
  );
}
