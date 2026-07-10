'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatFecha } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

const PREMIO_VACIO = { nombre: '', descripcion: '', puntos_requeridos: '', stock: '', activo: true };

export default function FidelizacionPage() {
  const { esDueno } = usePerfil();
  const [cfg, setCfg] = useState(null);
  const [premios, setPremios] = useState([]);
  const [movs, setMovs] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [premioForm, setPremioForm] = useState(null);
  const [canje, setCanje] = useState({ clienteId: '', saldo: null });
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: c }, { data: ps }, { data: ms }, { data: cls }] = await Promise.all([
      supabase.from('fidelizacion_config').select('*').maybeSingle(),
      supabase.from('premios').select('*').order('puntos_requeridos'),
      supabase.from('puntos_movimientos').select('*, clientes(nombre)').order('created_at', { ascending: false }).limit(20),
      supabase.from('clientes').select('id, nombre').order('nombre'),
    ]);
    setCfg(c || { activo: false, puntos_por_mil: 10, nombre_programa: 'Soporte Puntos' });
    setPremios(ps || []);
    setMovs(ms || []);
    setClientes(cls || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarCfg(e) {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    const { data: neg } = await supabase.from('negocios').select('id').maybeSingle();
    const { error: err } = await supabase.from('fidelizacion_config').upsert(
      {
        negocio_id: neg.id,
        activo: cfg.activo,
        puntos_por_mil: Number(cfg.puntos_por_mil) || 0,
        nombre_programa: cfg.nombre_programa || 'Soporte Puntos',
      },
      { onConflict: 'negocio_id' }
    );
    setOcupado(false);
    if (err) setError(err.message);
    else setAviso('Programa guardado.');
  }

  async function guardarPremio(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const datos = {
      nombre: premioForm.nombre.trim(),
      descripcion: premioForm.descripcion?.trim() || null,
      puntos_requeridos: Number(premioForm.puntos_requeridos) || 0,
      stock: premioForm.stock === '' ? null : Number(premioForm.stock),
      activo: !!premioForm.activo,
    };
    const { error: err } = premioForm.id
      ? await supabase.from('premios').update(datos).eq('id', premioForm.id)
      : await supabase.from('premios').insert(datos);
    setOcupado(false);
    if (err) return setError(err.message);
    setPremioForm(null);
    cargar();
  }

  async function eliminarPremio(p) {
    if (!window.confirm(`¿Eliminar el premio "${p.nombre}"?`)) return;
    const { error: err } = await supabase.from('premios').delete().eq('id', p.id);
    if (err) setError(err.message);
    else cargar();
  }

  async function verSaldo(clienteId) {
    setCanje({ clienteId, saldo: null });
    if (!clienteId) return;
    const { data } = await supabase.rpc('saldo_puntos', { p_cliente_id: clienteId });
    setCanje({ clienteId, saldo: data ?? 0 });
  }

  async function canjear(premio) {
    if (!canje.clienteId) return;
    if (!window.confirm(`¿Canjear "${premio.nombre}" por ${premio.puntos_requeridos} puntos?`)) return;
    setError(null);
    const { data, error: err } = await supabase.rpc('canjear_premio', {
      p_cliente_id: canje.clienteId,
      p_premio_id: premio.id,
    });
    if (err) return setError(err.message);
    setCanje((c) => ({ ...c, saldo: data.saldo }));
    setAviso('Canje registrado.');
    cargar();
  }

  if (!cfg) return <PantallaCarga />;

  const setP = (campo) => (e) =>
    setPremioForm({ ...premioForm, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <main>
      <h1 className="panel-h1">Fidelización</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {aviso && <div className="alert alert-ok">{aviso}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Config del programa */}
        <div className="card">
          <h2>Programa de puntos</h2>
          {!esDueno ? (
            <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede configurar el programa.</p>
          ) : (
            <form onSubmit={guardarCfg}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
                <input type="checkbox" checked={cfg.activo} onChange={(e) => setCfg({ ...cfg, activo: e.target.checked })} style={{ width: 'auto' }} />
                Programa activo (los clientes suman puntos en cada venta)
              </label>
              <div className="grid-2">
                <div className="field">
                  <label>Nombre del programa</label>
                  <input value={cfg.nombre_programa} onChange={(e) => setCfg({ ...cfg, nombre_programa: e.target.value })} />
                </div>
                <div className="field">
                  <label>Puntos por cada $1.000</label>
                  <input type="number" min="0" value={cfg.puntos_por_mil} onChange={(e) => setCfg({ ...cfg, puntos_por_mil: e.target.value })} />
                </div>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '.82rem', marginBottom: 10 }}>
                Ej: con {cfg.puntos_por_mil || 0} pts/$1.000, una venta de $10.000 suma {Math.floor((10000 / 1000) * (Number(cfg.puntos_por_mil) || 0))} puntos.
              </p>
              <button className="btn" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Guardar programa'}</button>
            </form>
          )}
        </div>

        {/* Canje rápido */}
        <div className="card">
          <h2>Canjear puntos</h2>
          <div className="field">
            <label>Cliente</label>
            <select value={canje.clienteId} onChange={(e) => verSaldo(e.target.value)}>
              <option value="">— Elegí un cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          {canje.clienteId && (
            <>
              <div className="pos-total-box" style={{ marginBottom: 12 }}>
                <span className="lbl">Saldo de puntos</span>
                <span className="val">{canje.saldo ?? '…'}</span>
              </div>
              {premios.filter((p) => p.activo).length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>Cargá premios para poder canjear.</p>
              ) : (
                premios.filter((p) => p.activo).map((p) => {
                  const alcanza = (canje.saldo ?? 0) >= p.puntos_requeridos && (p.stock == null || p.stock > 0);
                  return (
                    <div className="carrito-item" key={p.id}>
                      <div className="info">
                        <div>{p.nombre}</div>
                        <div className="meta">{p.puntos_requeridos} pts{p.stock != null ? ` · stock ${p.stock}` : ''}</div>
                      </div>
                      <button className="btn btn-sm" disabled={!alcanza} onClick={() => canjear(p)}>Canjear</button>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      {/* Premios CRUD */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Premios ({premios.length})</h2>
          {esDueno && !premioForm && (
            <button className="btn btn-sm" onClick={() => setPremioForm({ ...PREMIO_VACIO })}>+ Nuevo premio</button>
          )}
        </div>

        {premioForm && (
          <form onSubmit={guardarPremio} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre *</label><input required value={premioForm.nombre} onChange={setP('nombre')} /></div>
              <div className="field"><label>Puntos requeridos *</label><input required type="number" min="1" value={premioForm.puntos_requeridos} onChange={setP('puntos_requeridos')} /></div>
              <div className="field"><label>Descripción</label><input value={premioForm.descripcion || ''} onChange={setP('descripcion')} /></div>
              <div className="field"><label>Stock (vacío = ilimitado)</label><input type="number" min="0" value={premioForm.stock} onChange={setP('stock')} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
              <input type="checkbox" checked={premioForm.activo} onChange={setP('activo')} style={{ width: 'auto' }} /> Activo
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Guardar'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setPremioForm(null)}>Cancelar</button>
            </div>
          </form>
        )}

        {premios.length > 0 && (
          <div className="tabla-scroll" style={{ marginTop: 12 }}>
            <table className="tabla">
              <thead><tr><th>Premio</th><th>Puntos</th><th>Stock</th><th></th></tr></thead>
              <tbody>
                {premios.map((p) => (
                  <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                    <td><strong>{p.nombre}</strong>{p.descripcion && <div className="meta">{p.descripcion}</div>}</td>
                    <td>{p.puntos_requeridos}</td>
                    <td>{p.stock ?? '∞'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {esDueno && (
                        <>
                          <button className="chip" onClick={() => setPremioForm({ ...p, descripcion: p.descripcion || '', stock: p.stock ?? '' })}>Editar</button>
                          <button className="chip" style={{ color: '#ef4444', marginLeft: 6 }} onClick={() => eliminarPremio(p)}>Eliminar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movimientos recientes */}
      {movs.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Movimientos recientes</h2>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Cliente</th><th>Detalle</th><th style={{ textAlign: 'right' }}>Puntos</th></tr></thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{formatFecha(m.created_at)}</td>
                    <td>{m.clientes?.nombre || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{m.descripcion}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: m.puntos >= 0 ? '#22c55e' : '#ef4444' }}>
                      {m.puntos >= 0 ? '+' : ''}{m.puntos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
