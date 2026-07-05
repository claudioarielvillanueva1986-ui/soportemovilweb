'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, PRIORIDADES } from '@/lib/supabase';

const DISPOSITIVOS = ['Celular', 'Tablet', 'Notebook', 'PC de escritorio', 'Consola', 'Otro'];

const NUEVA = '__nueva__';

export default function NuevaOrdenPage() {
  const router = useRouter();

  // Paso 1: cliente por DNI/teléfono
  const [doc, setDoc] = useState('');
  const [buscado, setBuscado] = useState(false);
  const [cliente, setCliente] = useState(null); // cliente existente
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', dni: '', telefono: '', email: '' });
  const [telActualizado, setTelActualizado] = useState('');

  // Paso 2: equipo
  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [equipo, setEquipo] = useState({
    dispositivo: 'Celular',
    marca: '',
    marcaNueva: '',
    modelo: '',
    modeloNuevo: '',
    descripcion: '',
    equipo_password: '',
    presupuesto: '',
    prioridad: 'normal',
  });

  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    supabase
      .from('equipo_marcas')
      .select('nombre')
      .order('nombre')
      .then(({ data }) => setMarcas((data || []).map((m) => m.nombre)));
  }, []);

  useEffect(() => {
    if (!equipo.marca || equipo.marca === NUEVA) {
      setModelos([]);
      return;
    }
    supabase
      .from('equipo_modelos')
      .select('nombre, usos')
      .eq('marca', equipo.marca)
      .order('usos', { ascending: false })
      .order('nombre')
      .then(({ data }) => setModelos((data || []).map((m) => m.nombre)));
  }, [equipo.marca]);

  async function buscarCliente(e) {
    e?.preventDefault();
    setError(null);
    const t = doc.trim().replace(/[%,()]/g, '');
    if (t.length < 3) {
      setError('Ingresá al menos 3 caracteres del DNI o teléfono.');
      return;
    }
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .or(`dni.ilike.%${t}%,telefono.ilike.%${t}%`)
      .limit(1)
      .maybeSingle();
    setBuscado(true);
    if (data) {
      setCliente(data);
      setTelActualizado(data.telefono || '');
    } else {
      setCliente(null);
      setNuevoCli({ nombre: '', dni: /^\d+$/.test(t) ? t : '', telefono: /^\d+$/.test(t) ? '' : t, email: '' });
    }
  }

  const setEq = (campo) => (e) => setEquipo({ ...equipo, [campo]: e.target.value });
  const setNc = (campo) => (e) => setNuevoCli({ ...nuevoCli, [campo]: e.target.value });

  async function crear(e) {
    e.preventDefault();
    setError(null);

    const marcaFinal = equipo.marca === NUEVA ? equipo.marcaNueva.trim() : equipo.marca;
    const modeloFinal = equipo.modelo === NUEVA ? equipo.modeloNuevo.trim() : equipo.modelo;
    if (!marcaFinal) {
      setError('Elegí o agregá la marca del equipo.');
      return;
    }

    setCreando(true);
    try {
      const { data: neg } = await supabase.from('negocios').select('id').maybeSingle();

      // Cliente: existente (con teléfono actualizable) o alta nueva
      let clienteId;
      let nombre;
      let telefono;
      let email;
      if (cliente) {
        clienteId = cliente.id;
        nombre = cliente.nombre;
        email = cliente.email;
        telefono = telActualizado.trim() || cliente.telefono;
        if (telActualizado.trim() && telActualizado.trim() !== cliente.telefono) {
          await supabase.from('clientes').update({ telefono: telActualizado.trim() }).eq('id', cliente.id);
        }
      } else {
        if (!nuevoCli.nombre.trim()) throw new Error('Ingresá el nombre del cliente.');
        const { data: cli, error: errCli } = await supabase
          .from('clientes')
          .insert({
            negocio_id: neg.id,
            nombre: nuevoCli.nombre.trim(),
            dni: nuevoCli.dni.trim() || null,
            telefono: nuevoCli.telefono.trim() || null,
            email: nuevoCli.email.trim().toLowerCase() || null,
          })
          .select('*')
          .single();
        if (errCli) throw new Error(errCli.message);
        clienteId = cli.id;
        nombre = cli.nombre;
        telefono = cli.telefono;
        email = cli.email;
      }

      // Marca/modelo nuevos quedan en el catálogo para la próxima
      if (equipo.marca === NUEVA) {
        await supabase.from('equipo_marcas').upsert(
          { negocio_id: neg.id, nombre: marcaFinal },
          { onConflict: 'negocio_id,nombre', ignoreDuplicates: true }
        );
      }
      if (modeloFinal && equipo.modelo === NUEVA) {
        await supabase.from('equipo_modelos').upsert(
          { negocio_id: neg.id, marca: marcaFinal, nombre: modeloFinal },
          { onConflict: 'negocio_id,marca,nombre', ignoreDuplicates: true }
        );
      }

      const { data, error: err } = await supabase.rpc('crear_orden_staff', {
        p_nombre: nombre,
        p_telefono: telefono,
        p_email: email,
        p_dispositivo: equipo.dispositivo,
        p_marca_modelo: [marcaFinal, modeloFinal].filter(Boolean).join(' '),
        p_descripcion: equipo.descripcion,
        p_prioridad: equipo.prioridad,
        p_presupuesto: equipo.presupuesto === '' ? null : Number(equipo.presupuesto),
        p_cliente_id: clienteId,
        p_equipo_password: equipo.equipo_password,
      });
      if (err) throw new Error(err.message);
      router.push(`/panel/imprimir/${data.id}`);
    } catch (err) {
      setError(err.message);
      setCreando(false);
    }
  }

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Nueva orden de reparación</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {/* Paso 1: cliente por documento */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>1 · Cliente</h2>
        <form onSubmit={buscarCliente}>
          <div className="grid-2" style={{ alignItems: 'end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>DNI o teléfono del cliente</label>
              <input
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                placeholder="32198864 o 1144004020"
                autoFocus
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <button className="btn" style={{ width: '100%' }}>
                Buscar cliente
              </button>
            </div>
          </div>
        </form>

        {buscado && cliente && (
          <div style={{ marginTop: 16, border: '1px solid var(--accent)', borderRadius: 8, padding: '14px 16px', background: 'var(--accent-soft)' }}>
            <div style={{ fontWeight: 700 }}>{cliente.nombre}</div>
            <div className="lbl2" style={{ marginBottom: 10 }}>
              {[cliente.dni && `DNI ${cliente.dni}`, cliente.email].filter(Boolean).join(' · ') || 'Cliente registrado'}
            </div>
            <div className="grid-2">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Teléfono (actualizalo si cambió)</label>
                <input value={telActualizado} onChange={(e) => setTelActualizado(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setCliente(null);
                    setBuscado(false);
                    setDoc('');
                  }}
                >
                  Buscar otro cliente
                </button>
              </div>
            </div>
          </div>
        )}

        {buscado && !cliente && (
          <div style={{ marginTop: 16 }}>
            <p className="lbl2" style={{ marginBottom: 10 }}>
              No existe un cliente con ese dato — se crea uno nuevo:
            </p>
            <div className="grid-2">
              <div className="field">
                <label>Nombre y apellido *</label>
                <input required value={nuevoCli.nombre} onChange={setNc('nombre')} />
              </div>
              <div className="field">
                <label>DNI</label>
                <input value={nuevoCli.dni} onChange={setNc('dni')} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input value={nuevoCli.telefono} onChange={setNc('telefono')} />
              </div>
              <div className="field">
                <label>Email (para seguimiento online)</label>
                <input type="email" value={nuevoCli.email} onChange={setNc('email')} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Paso 2: equipo, solo cuando ya hay cliente definido */}
      {buscado && (
        <form onSubmit={crear}>
          <div className="card" style={{ marginBottom: 16 }}>
            <h2>2 · Equipo y falla</h2>
            <div className="grid-2">
              <div className="field">
                <label>Tipo de equipo *</label>
                <select value={equipo.dispositivo} onChange={setEq('dispositivo')}>
                  {DISPOSITIVOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Marca *</label>
                <select value={equipo.marca} onChange={setEq('marca')} required>
                  <option value="">— Elegir marca —</option>
                  {marcas.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={NUEVA}>+ Agregar marca nueva...</option>
                </select>
                {equipo.marca === NUEVA && (
                  <input
                    style={{ marginTop: 8 }}
                    placeholder="Nombre de la marca nueva"
                    value={equipo.marcaNueva}
                    onChange={setEq('marcaNueva')}
                  />
                )}
              </div>
              <div className="field">
                <label>Modelo (los más usados primero)</label>
                <select value={equipo.modelo} onChange={setEq('modelo')}>
                  <option value="">— Sin especificar —</option>
                  {modelos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={NUEVA}>+ Agregar modelo nuevo...</option>
                </select>
                {equipo.modelo === NUEVA && (
                  <input
                    style={{ marginTop: 8 }}
                    placeholder="Nombre del modelo nuevo"
                    value={equipo.modeloNuevo}
                    onChange={setEq('modeloNuevo')}
                  />
                )}
              </div>
              <div className="field">
                <label>Clave / patrón del equipo</label>
                <input
                  value={equipo.equipo_password}
                  onChange={setEq('equipo_password')}
                  placeholder="Uso interno, no sale en el talón del cliente"
                />
              </div>
              <div className="field">
                <label>Presupuesto estimado ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={equipo.presupuesto}
                  onChange={setEq('presupuesto')}
                />
              </div>
              <div className="field">
                <label>Prioridad</label>
                <select value={equipo.prioridad} onChange={setEq('prioridad')}>
                  {Object.entries(PRIORIDADES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Falla reportada *</label>
              <textarea
                required
                value={equipo.descripcion}
                onChange={setEq('descripcion')}
                placeholder="Qué le pasa, desde cuándo, estado en que se recibe (rayones, golpes, si enciende)..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" disabled={creando}>
              {creando ? <span className="spinner" /> : 'Crear orden e imprimir'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/panel/tickets')}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
