'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

const VACIO = { codigo: '', tipo: 'porcentaje', valor: '', minimo_compra: '', usos_max: '', vencimiento: '', activo: true };

export default function CuponesPage() {
  const { esDueno } = usePerfil();
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('cupones').select('*').order('created_at', { ascending: false });
    setLista(data || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const set = (campo) => (e) =>
    setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const datos = {
      codigo: form.codigo.trim().toUpperCase(),
      tipo: form.tipo,
      valor: Number(form.valor) || 0,
      minimo_compra: Number(form.minimo_compra) || 0,
      usos_max: form.usos_max === '' ? null : Number(form.usos_max),
      vencimiento: form.vencimiento || null,
      activo: !!form.activo,
    };
    const { error: err } = form.id
      ? await supabase.from('cupones').update(datos).eq('id', form.id)
      : await supabase.from('cupones').insert(datos);
    setOcupado(false);
    if (err) return setError(err.message.includes('duplicate') ? 'Ya existe un cupón con ese código.' : err.message);
    setForm(null);
    cargar();
  }

  async function eliminar(c) {
    if (!window.confirm(`¿Eliminar el cupón ${c.codigo}?`)) return;
    const { error: err } = await supabase.from('cupones').delete().eq('id', c.id);
    if (err) setError(err.message);
    else cargar();
  }

  if (!lista) return <PantallaCarga />;

  return (
    <main>
      <div className="panel-h1-row">
        <h1>Cupones ({lista.length})</h1>
        {esDueno && !form && <button className="btn btn-sm" onClick={() => setForm({ ...VACIO })}>+ Nuevo cupón</button>}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!esDueno && <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede administrar cupones.</p>}

      {form && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>{form.id ? 'Editar cupón' : 'Nuevo cupón'}</h2>
          <form onSubmit={guardar}>
            <div className="grid-2">
              <div className="field"><label>Código *</label><input required value={form.codigo} onChange={set('codigo')} placeholder="PROMO10" style={{ textTransform: 'uppercase' }} /></div>
              <div className="field">
                <label>Tipo de descuento</label>
                <select value={form.tipo} onChange={set('tipo')}>
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="monto">Monto fijo ($)</option>
                </select>
              </div>
              <div className="field"><label>{form.tipo === 'porcentaje' ? 'Porcentaje %' : 'Monto $'} *</label><input required type="number" min="0" step="0.01" value={form.valor} onChange={set('valor')} /></div>
              <div className="field"><label>Compra mínima ($)</label><input type="number" min="0" step="0.01" value={form.minimo_compra} onChange={set('minimo_compra')} placeholder="0" /></div>
              <div className="field"><label>Usos máximos (vacío = ilimitado)</label><input type="number" min="1" value={form.usos_max} onChange={set('usos_max')} /></div>
              <div className="field"><label>Vence el (opcional)</label><input type="date" value={form.vencimiento} onChange={set('vencimiento')} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
              <input type="checkbox" checked={form.activo} onChange={set('activo')} style={{ width: 'auto' }} /> Activo
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Guardar'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {lista.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>No hay cupones. Creá uno para usarlo en el POS.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Código</th><th>Descuento</th><th>Mínimo</th><th>Usos</th><th>Vence</th><th></th></tr></thead>
            <tbody>
              {lista.map((c) => {
                const vencido = c.vencimiento && new Date(c.vencimiento + 'T23:59') < new Date();
                const agotado = c.usos_max != null && c.usos_actual >= c.usos_max;
                return (
                  <tr key={c.id} style={{ opacity: c.activo && !vencido && !agotado ? 1 : 0.5 }}>
                    <td><strong style={{ fontFamily: 'ui-monospace, monospace' }}>{c.codigo}</strong></td>
                    <td>{c.tipo === 'porcentaje' ? `${c.valor}%` : formatMoney(c.valor)}</td>
                    <td>{c.minimo_compra > 0 ? formatMoney(c.minimo_compra) : '—'}</td>
                    <td>{c.usos_actual}{c.usos_max != null ? ` / ${c.usos_max}` : ''}</td>
                    <td>{c.vencimiento ? new Date(c.vencimiento + 'T12:00').toLocaleDateString('es-AR') : '—'}{vencido && ' ⚠️'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {esDueno && (
                        <>
                          <button className="chip" onClick={() => setForm({ ...c, minimo_compra: c.minimo_compra || '', usos_max: c.usos_max ?? '', vencimiento: c.vencimiento || '' })}>Editar</button>
                          <button className="chip" style={{ color: '#ef4444', marginLeft: 6 }} onClick={() => eliminar(c)}>Eliminar</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
