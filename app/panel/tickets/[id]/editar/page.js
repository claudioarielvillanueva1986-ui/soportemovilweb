'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, ESTADOS, PRIORIDADES, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

export default function EditarOrdenPage() {
  const { id } = useParams();
  const router = useRouter();
  const { esDueno } = usePerfil();

  const [ticket, setTicket] = useState(null);
  const [form, setForm] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from('tickets')
      .select('*, clientes(id, dni)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('No se encontró la orden.');
          return;
        }
        setTicket(data);
        setForm({
          nombre: data.nombre || '',
          telefono: data.telefono || '',
          email: data.email || '',
          dni: data.clientes?.dni || '',
          dispositivo: data.dispositivo || '',
          marca_modelo: data.marca_modelo || '',
          imei_serial: data.imei_serial || '',
          color: data.color || '',
          equipo_password: data.equipo_password || '',
          condicion_fisica: data.condicion_fisica || '',
          descripcion: data.descripcion || '',
          estado: data.estado,
          prioridad: data.prioridad,
          presupuesto: data.presupuesto ?? '',
          tecnico_id: data.tecnico_id || '',
        });
      });
    supabase.rpc('equipo_negocio').then(({ data }) => setEquipo(data || []));
  }, [id]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);

    const patch = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      dispositivo: form.dispositivo.trim(),
      marca_modelo: form.marca_modelo.trim() || null,
      imei_serial: form.imei_serial.trim() || null,
      color: form.color.trim() || null,
      equipo_password: form.equipo_password.trim() || null,
      condicion_fisica: form.condicion_fisica.trim() || null,
      descripcion: form.descripcion.trim(),
      estado: form.estado,
      prioridad: form.prioridad,
    };
    if (esDueno) {
      patch.presupuesto = form.presupuesto === '' ? null : Number(form.presupuesto);
    }

    const { error: errUpd } = await supabase.from('tickets').update(patch).eq('id', id);
    let errMsg = errUpd?.message;

    if (!errMsg && ticket.clientes?.id && form.dni.trim() !== (ticket.clientes.dni || '')) {
      const { error: errCli } = await supabase
        .from('clientes')
        .update({ dni: form.dni.trim() || null })
        .eq('id', ticket.clientes.id);
      errMsg = errCli?.message;
    }

    if (!errMsg && form.tecnico_id !== (ticket.tecnico_id || '')) {
      const { error: errTec } = await supabase.rpc('asignar_tecnico', {
        p_ticket_id: id,
        p_tecnico_id: form.tecnico_id || null,
      });
      errMsg = errTec?.message;
    }

    setGuardando(false);
    if (errMsg) {
      setAviso({ tipo: 'error', texto: errMsg });
      return;
    }
    router.push('/panel/tickets');
  }

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!form) return <PantallaCarga />;

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 18px', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.5rem' }}>Editar orden {ticket.numero}</h1>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.push('/panel/tickets')}>
          ← Volver sin guardar
        </button>
      </div>

      {aviso && <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{aviso.texto}</div>}

      <form onSubmit={guardar}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Datos del cliente</h2>
          <div className="grid-2">
            <div className="field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={set('nombre')} required />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={set('telefono')} />
            </div>
            <div className="field">
              <label>DNI</label>
              <input value={form.dni} onChange={set('dni')} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Datos del equipo</h2>
          <div className="grid-2">
            <div className="field">
              <label>Tipo / dispositivo</label>
              <input value={form.dispositivo} onChange={set('dispositivo')} required />
            </div>
            <div className="field">
              <label>Marca / modelo</label>
              <input value={form.marca_modelo} onChange={set('marca_modelo')} />
            </div>
            <div className="field">
              <label>IMEI / Serial</label>
              <input value={form.imei_serial} onChange={set('imei_serial')} style={{ fontFamily: 'var(--mono)' }} />
            </div>
            <div className="field">
              <label>Color</label>
              <input value={form.color} onChange={set('color')} />
            </div>
            <div className="field">
              <label>Clave / patrón del equipo</label>
              <input value={form.equipo_password} onChange={set('equipo_password')} />
            </div>
          </div>
          <div className="field">
            <label>Condición física recibida</label>
            <textarea
              value={form.condicion_fisica}
              onChange={set('condicion_fisica')}
              placeholder="Rayones, golpes, faltantes, si enciende al recibir..."
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Servicio</h2>
          <div className="field">
            <label>Falla reportada</label>
            <textarea value={form.descripcion} onChange={set('descripcion')} required />
          </div>
          <div className="field">
            <label>Técnico asignado</label>
            <select value={form.tecnico_id} onChange={set('tecnico_id')}>
              <option value="">Sin asignar</option>
              {equipo.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.nombre}
                  {p.rol === 'dueno' ? ' (dueño)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Estado</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(ESTADOS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                className="chip"
                onClick={() => setForm((f) => ({ ...f, estado: k }))}
                style={{
                  background: form.estado === k ? `${v.color}22` : 'transparent',
                  color: form.estado === k ? v.color : 'var(--text-dim)',
                  borderColor: form.estado === k ? `${v.color}88` : 'var(--border)',
                  fontWeight: form.estado === k ? 700 : 400,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Presupuesto</h2>
          <div className="grid-2">
            <div className="field">
              <label>Prioridad</label>
              <select value={form.prioridad} onChange={set('prioridad')}>
                {Object.entries(PRIORIDADES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Monto total ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.presupuesto}
                onChange={set('presupuesto')}
                disabled={!esDueno}
              />
              {!esDueno && (
                <p className="lbl2">El cambio de monto requiere aprobación del dueño.</p>
              )}
            </div>
          </div>
          {form.presupuesto !== '' && (
            <p className="lbl2">Total: <strong>{formatMoney(Number(form.presupuesto))}</strong></p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" disabled={guardando}>
            {guardando ? <span className="spinner" /> : 'Guardar cambios'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.push('/panel/tickets')}>
            Cancelar
          </button>
        </div>
      </form>
    </main>
  );
}
