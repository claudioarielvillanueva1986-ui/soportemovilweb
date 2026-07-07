'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

export default function TiendaConfigPage() {
  const { esDueno } = usePerfil();
  const [form, setForm] = useState(null);
  const [slug, setSlug] = useState('');
  const [cuantos, setCuantos] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.from('negocios').select('slug').maybeSingle().then(({ data }) => setSlug(data?.slug || ''));
    supabase.from('tienda_config').select('*').maybeSingle().then(({ data }) =>
      setForm({ activa: data?.activa ?? false, titulo: data?.titulo || '', descripcion: data?.descripcion || '', slogan: data?.slogan || '' })
    );
    supabase.from('productos').select('id', { count: 'exact', head: true }).eq('en_tienda', true).then(({ count }) => setCuantos(count ?? 0));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    const { data: neg } = await supabase.from('negocios').select('id').maybeSingle();
    const { error } = await supabase.from('tienda_config').upsert(
      { negocio_id: neg.id, activa: form.activa, titulo: form.titulo || null, descripcion: form.descripcion || null, slogan: form.slogan || null },
      { onConflict: 'negocio_id' }
    );
    setGuardando(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else setAviso({ tipo: 'ok', texto: 'Tienda guardada.' });
  }

  if (!form) return <PantallaCarga />;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/tienda/${slug}` : '';

  return (
    <TiendaBody form={form} setForm={setForm} slug={slug} url={url} cuantos={cuantos} aviso={aviso} guardando={guardando} guardar={guardar} esDueno={esDueno} />
  );
}

function TiendaBody({ form, setForm, slug, url, cuantos, aviso, guardando, guardar, esDueno }) {
  const [pend, setPend] = useState([]);

  const cargarPend = () => supabase
    .from('producto_resenas')
    .select('*, productos(nombre)')
    .eq('aprobada', false)
    .order('created_at', { ascending: false })
    .then(({ data }) => setPend(data || []));

  useEffect(() => { cargarPend(); }, []);

  async function aprobar(r) {
    await supabase.from('producto_resenas').update({ aprobada: true }).eq('id', r.id);
    cargarPend();
  }
  async function rechazar(r) {
    await supabase.from('producto_resenas').delete().eq('id', r.id);
    cargarPend();
  }

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Tienda online</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ color: 'var(--text-dim)', marginBottom: 8 }}>Tu tienda pública:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={`/tienda/${slug}`} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{url}</a>
          <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(url)}>Copiar</button>
        </div>
        <p className="lbl2" style={{ marginTop: 10 }}>
          {cuantos != null && `${cuantos} producto(s) publicado(s).`} Marcá productos con “Publicar en la tienda” desde Inventario.
        </p>
      </div>

      <div className="card">
        <h2>Configuración</h2>
        {aviso && <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{aviso.texto}</div>}
        {!esDueno ? (
          <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede configurar la tienda.</p>
        ) : (
          <form onSubmit={guardar}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
              <input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} style={{ width: 'auto' }} />
              Tienda activa (visible para tus clientes)
            </label>
            <div className="field"><label>Título</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Tienda Soporte Móvil" /></div>
            <div className="field"><label>Slogan</label><input value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} placeholder="Accesorios y repuestos con garantía" /></div>
            <div className="field"><label>Descripción</label><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} style={{ minHeight: 60 }} /></div>
            <button className="btn" disabled={guardando}>{guardando ? <span className="spinner" /> : 'Guardar tienda'}</button>
          </form>
        )}
      </div>

      {esDueno && pend.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Reseñas por aprobar ({pend.length})</h2>
          {pend.map((r) => (
            <div className="carrito-item" key={r.id} style={{ alignItems: 'flex-start' }}>
              <div className="info">
                <div>{'⭐'.repeat(r.estrellas)} <strong>{r.nombre}</strong> <span className="lbl2">· {r.productos?.nombre}</span></div>
                {r.comentario && <div className="meta" style={{ marginTop: 2 }}>{r.comentario}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => aprobar(r)}>Aprobar</button>
                <button className="chip" style={{ color: '#ef4444' }} onClick={() => rechazar(r)}>Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
