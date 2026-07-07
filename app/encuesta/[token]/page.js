'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

function Estrellas({ valor, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={`star ${n <= valor ? 'on' : ''}`} onClick={() => onChange(n)} aria-label={`${n} estrellas`}>
          ⭐
        </button>
      ))}
    </div>
  );
}

export default function EncuestaPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(undefined);
  const [estrellas, setEstrellas] = useState(0);
  const [rapidez, setRapidez] = useState(0);
  const [atencion, setAtencion] = useState(0);
  const [recomendaria, setRecomendaria] = useState(null);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    supabase.rpc('encuesta_ver', { p_token: token }).then(({ data }) => setInfo(data ?? null));
  }, [token]);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    if (!estrellas) return setError('Elegí una puntuación general.');
    setEnviando(true);
    const { error: err } = await supabase.rpc('responder_encuesta', {
      p_token: token,
      p_estrellas: estrellas,
      p_rapidez: rapidez,
      p_atencion: atencion,
      p_comentario: comentario,
      p_recomendaria: recomendaria,
    });
    setEnviando(false);
    if (err) return setError(err.message);
    setListo(true);
  }

  if (info === undefined) return <PantallaCarga />;

  if (info === null) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
          <h2>Encuesta no encontrada</h2>
          <p style={{ color: 'var(--text-dim)' }}>El link no es válido o expiró.</p>
        </div>
      </main>
    );
  }

  if (listo || info.respondida) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>🙌</div>
          <h2>¡Gracias por tu opinión!</h2>
          <p style={{ color: 'var(--text-dim)' }}>Nos ayuda muchísimo a mejorar.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="hero">
        <h1>¿Cómo estuvo tu <em>experiencia</em>?</h1>
        <p>{info.negocio} · {info.equipo || 'tu reparación'}</p>
      </div>
      <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={enviar}>
          <div className="rate-row">
            <div className="rate-lbl">Puntuación general *</div>
            <Estrellas valor={estrellas} onChange={setEstrellas} />
          </div>
          <div className="rate-row">
            <div className="rate-lbl">Rapidez</div>
            <Estrellas valor={rapidez} onChange={setRapidez} />
          </div>
          <div className="rate-row">
            <div className="rate-lbl">Atención</div>
            <Estrellas valor={atencion} onChange={setAtencion} />
          </div>
          <div className="rate-row">
            <div className="rate-lbl">¿Nos recomendarías?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className={`btn btn-sm ${recomendaria === true ? '' : 'btn-secondary'}`} onClick={() => setRecomendaria(true)}>👍 Sí</button>
              <button type="button" className={`btn btn-sm ${recomendaria === false ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setRecomendaria(false)}>👎 No</button>
            </div>
          </div>
          <div className="field">
            <label>Comentario (opcional)</label>
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} style={{ minHeight: 70 }} placeholder="Contanos qué te pareció…" />
          </div>
          <button className="btn" style={{ width: '100%' }} disabled={enviando}>
            {enviando ? <span className="spinner" /> : 'Enviar opinión'}
          </button>
        </form>
      </div>
    </main>
  );
}
