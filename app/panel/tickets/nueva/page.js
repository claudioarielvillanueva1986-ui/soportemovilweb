'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, PRIORIDADES, METODOS_PAGO, ESTADOS, formatMoney, formatFecha } from '@/lib/supabase';
import { useCobroReal, ModalCobroReal, METODOS_ELECTRONICOS_ORDEN } from '@/components/cobro-real';
import { construirMensaje, PLANTILLA_RECIBIDO_DEFECTO } from '@/lib/whatsapp';
import { ImagenEquipo } from '@/components/imagen-equipo';

const DISPOSITIVOS = ['Celular', 'Tablet', 'Notebook', 'PC de escritorio', 'Consola', 'Otro'];

const NUEVA = '__nueva__';

// Checklist de recepción — igual que v1: queda impreso en la copia del
// técnico del comprobante y respalda cómo llegó el equipo ante un reclamo.
const ESTADOS_PANTALLA = ['Sin daños', 'Rayada', 'Rajada', 'Rota', 'Sin pantalla', 'Táctil fallando', 'Imagen fallando'];
const CONDICIONES_GENERALES = ['Excelente', 'Bueno', 'Regular', 'Malo', 'Muy malo'];
const MODOS_INGRESO = ['Solo teléfono', 'Con caja', 'En bolsa', 'Con funda', 'Desmontado', 'Con pantalla rota suelta', 'Mojado', 'Con golpe visible'];
const ACCESORIOS_OPCIONES = ['Carcasa', 'Cargador', 'Cable USB', 'Auriculares', 'Bandeja SIM', 'SIM Card', 'MicroSD', 'Caja original', 'Batería suelta', 'Lápiz/Stylus', 'Manual', 'Vidrio templado'];
const TIPOS_REPARACION = ['Cambio de pantalla', 'Batería', 'Puerto de carga', 'Software/Formateo', 'Cámara', 'Botones', 'Conector audio', 'Placa/Soldadura', 'Carcasa/Chasis', 'Desgabinete', 'Altavoz/Micrófono', 'Vibrador', 'WiFi/Antena', 'Mojado/Corrosión', 'Diagnóstico', 'Otro'];

function toggleEnArray(arr, valor) {
  return arr.includes(valor) ? arr.filter((v) => v !== valor) : [...arr, valor];
}

// Chips tipo píldora de v1 (.choice-chip): multi-selección.
function ChipsMulti({ opciones, valor, onToggle }) {
  return (
    <div className="choice-chips">
      {opciones.map((op) => (
        <button
          key={op}
          type="button"
          className={`choice-chip ${valor.includes(op) ? 'active' : ''}`}
          onClick={() => onToggle(op)}
        >
          {op}
        </button>
      ))}
    </div>
  );
}

// Igual, pero de una sola opción a la vez (estado de pantalla, condición
// general) — en v1 son chips exclusivos, no un <select>.
function ChipUnica({ opciones, valor, onElegir }) {
  return (
    <div className="choice-chips">
      {opciones.map((op) => (
        <button
          key={op}
          type="button"
          className={`choice-chip ${valor === op ? 'active' : ''}`}
          onClick={() => onElegir(valor === op ? '' : op)}
        >
          {op}
        </button>
      ))}
    </div>
  );
}

// Sugerencia de precio en base al historial (no es una IA real: busca
// órdenes terminadas parecidas por marca+modelo+palabras clave de la
// falla y muestra mediana/rango de lo cobrado — igual que v1).
function SugerenciaPresupuesto({ problema, marca, modelo, onUsar }) {
  const [cargando, setCargando] = useState(false);
  const [sugerencia, setSugerencia] = useState(null);
  const [sinDatos, setSinDatos] = useState(false);

  useEffect(() => {
    if (!problema || problema.trim().length < 5) {
      setSugerencia(null);
      setSinDatos(false);
      return;
    }
    const t = setTimeout(async () => {
      setCargando(true);
      const { data, error } = await supabase.rpc('sugerir_presupuesto', {
        p_problema: problema,
        p_marca: marca || '',
        p_modelo: modelo || '',
      });
      setCargando(false);
      if (error || !data?.sugerencia) {
        setSugerencia(null);
        setSinDatos(true);
        return;
      }
      setSinDatos(false);
      setSugerencia(data);
    }, 800);
    return () => clearTimeout(t);
  }, [problema, marca, modelo]);

  if (!cargando && !sugerencia && !sinDatos) return null;

  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        background: 'var(--bg-input)',
      }}
    >
      {cargando ? (
        <p className="lbl2">🔎 Buscando trabajos similares...</p>
      ) : sugerencia ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span className="lbl2">Precio sugerido</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>
                {formatMoney(sugerencia.sugerencia)}
              </div>
              <p className="lbl2" style={{ marginTop: 2 }}>
                {sugerencia.mensaje} — rango {formatMoney(sugerencia.minimo)} a {formatMoney(sugerencia.maximo)}
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onUsar(sugerencia.sugerencia)}>
              Usar este precio
            </button>
          </div>
          {sugerencia.ejemplos?.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              {sugerencia.ejemplos.map((e, i) => (
                <div key={i} className="lbl2" style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>{e.equipo} — {e.problema}</span>
                  <strong>{formatMoney(e.monto)}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="lbl2">Sin historial de trabajos parecidos todavía.</p>
      )}
    </div>
  );
}

// Alerta de cliente frecuente/VIP — igual criterio que v1: 5+ órdenes es
// VIP, 3+ es frecuente, menos que eso es primera visita (no se muestra).
function AlertaClienteFrecuente({ info }) {
  const total = info.total_ordenes || 0;
  if (total < 3) return null;
  const gastado = Number(info.total_gastado || 0);
  const puntos = info.puntos || 0;
  const esVip = total >= 5;
  const color = esVip ? 'var(--warn)' : 'var(--accent)';
  const icono = esVip ? '🏆' : '⭐';
  const titulo = esVip ? 'Cliente VIP' : 'Cliente frecuente';

  return (
    <div style={{ marginTop: 12, border: `1.5px solid ${color}`, borderRadius: 10, padding: '12px 14px', background: 'color-mix(in srgb, ' + color + ' 12%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{icono}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color }}>{titulo} — {info.nombre}</div>
            {info.ultima_visita && <div className="lbl2">Última visita: {formatFecha(info.ultima_visita)}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{total}</div>
            <div className="lbl2">órdenes</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>{formatMoney(gastado)}</div>
            <div className="lbl2">gastado</div>
          </div>
          {puntos > 0 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--warn)' }}>{puntos}</div>
              <div className="lbl2">puntos</div>
            </div>
          )}
        </div>
      </div>
      {info.ordenes_recientes?.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {info.ordenes_recientes.slice(0, 3).map((o) => (
            <div key={o.id} className="lbl2" style={{ padding: '2px 0' }}>
              {o.numero} · {[o.dispositivo, o.marca_modelo].filter(Boolean).join(' ')} ·{' '}
              <span style={{ color: ESTADOS[o.estado]?.color }}>{ESTADOS[o.estado]?.label || o.estado}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NuevaOrdenPage() {
  const router = useRouter();

  // Paso 1: cliente por DNI/teléfono
  const [doc, setDoc] = useState('');
  const [buscado, setBuscado] = useState(false);
  const [cliente, setCliente] = useState(null); // cliente existente
  const [infoCliente, setInfoCliente] = useState(null); // frecuencia/VIP del cliente encontrado
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
    color: '',
    imei_serial: '',
    descripcion: '',
    equipo_password: '',
    condicion_fisica: '',
    estado_pantalla: '',
    condicion_general: '',
    modo_ingreso: [],
    accesorios: [],
    tipo_reparacion: [],
    presupuesto: '',
    prioridad: 'normal',
    sena: '',
    sena_metodo: 'efectivo',
    tecnico_id: '',
  });

  const [servicios, setServicios] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  const [facturaConectada, setFacturaConectada] = useState(false);
  const [negocio, setNegocio] = useState(null);
  const { cobro, iniciarCobro, cancelarCobro, continuarTrasCobro } = useCobroReal();

  useEffect(() => {
    supabase
      .from('negocios')
      .select('nombre, wa_aviso_recibido')
      .maybeSingle()
      .then(({ data }) => setNegocio(data));
    supabase
      .from('servicios')
      .select('id, nombre, precio')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setServicios(data || []));
    supabase.rpc('equipo_negocio').then(({ data }) => setTecnicos(data || []));
  }, []);

  useEffect(() => {
    supabase
      .from('facturacion_conexion')
      .select('conectado')
      .maybeSingle()
      .then(({ data }) => setFacturaConectada(!!data?.conectado));
  }, []);

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
      setInfoCliente(null);
      supabase.rpc('info_cliente_frecuente', { p_cliente_id: data.id }).then(({ data: info }) => setInfoCliente(info || null));
    } else {
      setCliente(null);
      setInfoCliente(null);
      setNuevoCli({ nombre: '', dni: /^\d+$/.test(t) ? t : '', telefono: /^\d+$/.test(t) ? '' : t, email: '' });
    }
  }

  const setEq = (campo) => (e) => setEquipo({ ...equipo, [campo]: e.target.value });
  const setNc = (campo) => (e) => setNuevoCli({ ...nuevoCli, [campo]: e.target.value });

  function agregarServicioRapido(s) {
    setEquipo((eq) => ({
      ...eq,
      descripcion: eq.descripcion
        ? `${eq.descripcion}${/[.\n]\s*$/.test(eq.descripcion) ? '' : '.'} ${s.nombre}`
        : s.nombre,
      presupuesto: String((Number(eq.presupuesto) || 0) + Number(s.precio)),
    }));
  }

  // Mismo cliente + mismo equipo dado de alta hace menos de 3 minutos:
  // probablemente un doble click/doble carga por accidente.
  async function hayDuplicadoReciente(nombreCheck) {
    const desde = new Date(Date.now() - 3 * 60000).toISOString();
    let q = supabase.from('tickets').select('id, numero').gte('created_at', desde).limit(1);
    q = cliente ? q.eq('cliente_id', cliente.id) : q.eq('nombre', nombreCheck.trim());
    const { data } = await q;
    return data?.[0] || null;
  }

  async function crear(e) {
    e.preventDefault();
    setError(null);

    const marcaFinal = equipo.marca === NUEVA ? equipo.marcaNueva.trim() : equipo.marca;
    const modeloFinal = equipo.modelo === NUEVA ? equipo.modeloNuevo.trim() : equipo.modelo;
    if (!marcaFinal) {
      setError('Elegí o agregá la marca del equipo.');
      return;
    }

    const nombreCheck = cliente ? cliente.nombre : nuevoCli.nombre;
    const dup = await hayDuplicadoReciente(nombreCheck);
    if (dup && !window.confirm(`Ya se cargó la orden ${dup.numero} para este cliente hace menos de 3 minutos. ¿Creás otra igual de todos modos?`)) {
      return;
    }

    const senaMonto = equipo.sena === '' ? 0 : Number(equipo.sena);
    if (facturaConectada && senaMonto > 0 && METODOS_ELECTRONICOS_ORDEN.includes(equipo.sena_metodo)) {
      iniciarCobro(senaMonto, 'Seña de orden nueva', (mpPaymentId) => crearOrden(marcaFinal, modeloFinal, mpPaymentId));
      return;
    }
    await crearOrden(marcaFinal, modeloFinal, null);
  }

  async function crearOrden(marcaFinal, modeloFinal, senaMpPaymentId) {
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
        p_sena: equipo.sena === '' ? null : Number(equipo.sena),
        p_sena_metodo: equipo.sena_metodo,
        p_sena_mp_payment_id: senaMpPaymentId,
        p_color: equipo.color,
        p_condicion_fisica: equipo.condicion_fisica,
        p_estado_pantalla: equipo.estado_pantalla,
        p_condicion_general: equipo.condicion_general,
        p_modo_ingreso: equipo.modo_ingreso,
        p_accesorios: equipo.accesorios,
        p_tipo_reparacion: equipo.tipo_reparacion,
        p_imei_serial: equipo.imei_serial,
        p_tecnico_id: equipo.tecnico_id || null,
      });
      if (err) throw new Error(err.message);

      // Aviso automático al cliente (no bloquea el alta si falla o no está conectado).
      supabase.auth.getSession().then(({ data: sesion }) => {
        fetch('/api/whatsapp/notificar-orden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token || ''}` },
          body: JSON.stringify({ ticket_id: data.id, tipo: 'recibido' }),
        }).catch(() => {});
      });

      router.push(`/panel/imprimir/${data.id}?autoprint=1`);
    } catch (err) {
      setError(err.message);
      setCreando(false);
    }
  }

  return (
    <main>
      <h1 className="panel-h1">Nueva orden de reparación</h1>
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
                    setInfoCliente(null);
                    setBuscado(false);
                    setDoc('');
                  }}
                >
                  Buscar otro cliente
                </button>
              </div>
            </div>
            {infoCliente && <AlertaClienteFrecuente info={infoCliente} />}
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
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
                  <ImagenEquipo
                    marca={equipo.marca === NUEVA ? equipo.marcaNueva : equipo.marca}
                    modelo={equipo.modelo === NUEVA ? equipo.modeloNuevo : equipo.modelo}
                  />
                </div>
              </div>
              <div className="field">
                <label>Color</label>
                <input value={equipo.color} onChange={setEq('color')} placeholder="Ej: negro" />
              </div>
              <div className="field">
                <label>IMEI / N° de serie</label>
                <input value={equipo.imei_serial} onChange={setEq('imei_serial')} placeholder="Opcional" />
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

            <p className="lbl2" style={{ margin: '10px 0 6px', fontWeight: 700 }}>
              Checklist de recepción (queda en el talón del técnico)
            </p>
            <div className="field">
              <label>Estado de la pantalla</label>
              <ChipUnica
                opciones={ESTADOS_PANTALLA}
                valor={equipo.estado_pantalla}
                onElegir={(v) => setEquipo((eq) => ({ ...eq, estado_pantalla: v }))}
              />
            </div>
            <div className="field">
              <label>Condición general</label>
              <ChipUnica
                opciones={CONDICIONES_GENERALES}
                valor={equipo.condicion_general}
                onElegir={(v) => setEquipo((eq) => ({ ...eq, condicion_general: v }))}
              />
            </div>
            <div className="field">
              <label>Cómo ingresa el equipo</label>
              <ChipsMulti
                opciones={MODOS_INGRESO}
                valor={equipo.modo_ingreso}
                onToggle={(op) => setEquipo((eq) => ({ ...eq, modo_ingreso: toggleEnArray(eq.modo_ingreso, op) }))}
              />
            </div>
            <div className="field">
              <label>Accesorios que deja</label>
              <ChipsMulti
                opciones={ACCESORIOS_OPCIONES}
                valor={equipo.accesorios}
                onToggle={(op) => setEquipo((eq) => ({ ...eq, accesorios: toggleEnArray(eq.accesorios, op) }))}
              />
            </div>
            <div className="field">
              <label>Condición física (rayones, golpes, detalles a mano)</label>
              <textarea
                value={equipo.condicion_fisica}
                onChange={setEq('condicion_fisica')}
                placeholder="Ej: rayón en el marco superior derecho"
              />
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
            <SugerenciaPresupuesto
              problema={equipo.descripcion}
              marca={equipo.marca === NUEVA ? equipo.marcaNueva : equipo.marca}
              modelo={equipo.modelo === NUEVA ? equipo.modeloNuevo : equipo.modelo}
              onUsar={(monto) => setEquipo((eq) => ({ ...eq, presupuesto: String(monto) }))}
            />
            {(cliente?.nombre || nuevoCli.nombre) && (
              <div style={{ marginTop: 14, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <p className="lbl2" style={{ marginBottom: 6 }}>💬 Así le va a llegar el aviso de "recibido" por WhatsApp</p>
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                  {construirMensaje(negocio?.wa_aviso_recibido || PLANTILLA_RECIBIDO_DEFECTO, {
                    ticket: {
                      nombre: cliente?.nombre || nuevoCli.nombre,
                      marca_modelo: [equipo.marca === NUEVA ? equipo.marcaNueva : equipo.marca, equipo.modelo === NUEVA ? equipo.modeloNuevo : equipo.modelo].filter(Boolean).join(' ') || equipo.dispositivo,
                      numero: '(se genera al crear)',
                    },
                    negocio: negocio?.nombre,
                    host: typeof window !== 'undefined' ? window.location.host : '',
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2>3 · Diagnóstico y servicio</h2>
            <div className="field">
              <label>Tipo de reparación</label>
              <ChipsMulti
                opciones={TIPOS_REPARACION}
                valor={equipo.tipo_reparacion}
                onToggle={(op) => setEquipo((eq) => ({ ...eq, tipo_reparacion: toggleEnArray(eq.tipo_reparacion, op) }))}
              />
            </div>
            {servicios.length > 0 && (
              <div className="field">
                <label>Servicios rápidos (suman a la falla y al presupuesto)</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {servicios.map((s) => (
                    <button key={s.id} type="button" className="chip" onClick={() => agregarServicioRapido(s)}>
                      + {s.nombre} ({formatMoney(s.precio)})
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tecnicos.length > 0 && (
              <div className="field">
                <label>Asignar técnico (opcional)</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`chip ${!equipo.tecnico_id ? 'active' : ''}`}
                    onClick={() => setEquipo((eq) => ({ ...eq, tecnico_id: '' }))}
                  >
                    Sin asignar
                  </button>
                  {tecnicos.map((t) => (
                    <button
                      key={t.user_id}
                      type="button"
                      className={`chip ${equipo.tecnico_id === t.user_id ? 'active' : ''}`}
                      onClick={() => setEquipo((eq) => ({ ...eq, tecnico_id: t.user_id }))}
                    >
                      {t.rol === 'dueno' ? '👑' : '🔧'} {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2>4 · Seña (opcional)</h2>
            <p className="lbl2" style={{ marginBottom: 12 }}>
              Si el cliente deja una seña al dejar el equipo, registrala acá. El
              saldo se cobra al entregar. Entra a la caja del turno.
            </p>
            <div className="grid-2">
              <div className="field">
                <label>Monto de la seña ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={equipo.sena}
                  onChange={setEq('sena')}
                  placeholder="0"
                />
              </div>
              <div className="field">
                <label>Método de la seña</label>
                <select value={equipo.sena_metodo} onChange={setEq('sena_metodo')}>
                  {Object.entries(METODOS_PAGO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {equipo.presupuesto && equipo.sena && (
              <p className="lbl2">
                Saldo al entregar:{' '}
                <strong style={{ color: 'var(--accent)' }}>
                  {formatMoney(Math.max(0, Number(equipo.presupuesto) - Number(equipo.sena)))}
                </strong>
              </p>
            )}
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

      <ModalCobroReal cobro={cobro} cancelarCobro={cancelarCobro} continuarTrasCobro={continuarTrasCobro} />
    </main>
  );
}
