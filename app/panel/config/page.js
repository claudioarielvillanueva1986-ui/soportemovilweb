'use client';

import { useEffect, useState } from 'react';
import { supabase, formatFecha } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { pushSoportado, suscribirPush } from '@/lib/push';
import { CargaTarjeta } from '@/components/cargando';

function TarjetaMercadoPago({ negocio, esDueno }) {
  const [estado, setEstado] = useState(null);
  const [device, setDevice] = useState('');
  const [aviso, setAviso] = useState(null);

  async function cargar() {
    const { data } = await supabase.rpc('mp_estado_conexion');
    setEstado(data);
    setDevice(data?.point_device_id || '');
  }

  useEffect(() => {
    cargar();
    const params = new URLSearchParams(window.location.search);
    if (params.get('mp') === 'ok') {
      setAviso({ tipo: 'ok', texto: '¡Cuenta de Mercado Pago conectada! Ya podés cobrar con QR desde el POS.' });
    } else if (params.get('mp') === 'error') {
      setAviso({ tipo: 'error', texto: `No se pudo conectar: ${params.get('detalle') || 'error desconocido'}. Probá de nuevo.` });
    }
  }, []);

  async function guardarDevice(e) {
    e.preventDefault();
    setAviso(null);
    const { error } = await supabase.rpc('mp_guardar_point_device', {
      p_device_id: device,
    });
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else {
      setAviso({ tipo: 'ok', texto: 'Terminal Point guardada.' });
      cargar();
    }
  }

  async function desconectar() {
    if (!confirm('¿Desconectar tu cuenta de Mercado Pago? Dejarás de poder cobrar con QR y Point.')) return;
    const { error } = await supabase.rpc('mp_desconectar');
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else cargar();
  }

  if (!estado) return <CargaTarjeta />;

  return (
    <div className="card">
      <h2>Cobros con Mercado Pago</h2>
      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>
          {aviso.texto}
        </div>
      )}

      {!estado.conectado ? (
        <>
          <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
            Conectá la cuenta de Mercado Pago <strong>de tu negocio</strong> en
            dos clics. Los cobros del punto de venta (QR y Point) van directo a
            tu cuenta — nosotros nunca tocamos tu plata.
          </p>
          {esDueno ? (
            <button
              className="btn"
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                const token = data?.session?.access_token;
                if (!token) {
                  setAviso({ tipo: 'error', texto: 'Sesión no válida, volvé a ingresar.' });
                  return;
                }
                window.location.href = `/api/mp/oauth/conectar?negocio=${negocio?.id}&token=${encodeURIComponent(token)}`;
              }}
            >
              Conectar con Mercado Pago
            </button>
          ) : (
            <p style={{ color: 'var(--text-dim)' }}>
              Solo el dueño del negocio puede conectar la cuenta.
            </p>
          )}
        </>
      ) : (
        <>
          <dl className="detalle-grid">
            <div>
              <dt>Estado</dt>
              <dd style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Conectado {estado.live_mode ? '(producción)' : '(prueba)'}
              </dd>
            </div>
            <div>
              <dt>Cuenta MP</dt>
              <dd>#{estado.mp_user_id}</dd>
            </div>
            <div>
              <dt>QR dinámico</dt>
              <dd>{estado.pos_external_id ? 'Listo para cobrar' : 'Sin caja creada — reconectá'}</dd>
            </div>
            <div>
              <dt>Conectado desde</dt>
              <dd>{formatFecha(estado.conectado_desde)}</dd>
            </div>
          </dl>

          {esDueno && (
            <>
              <form onSubmit={guardarDevice} style={{ marginTop: 8 }}>
                <div className="field">
                  <label>Terminal Point (opcional)</label>
                  <input
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                    placeholder="ID del dispositivo, ej: NEWLAND_N950__N950NCC..."
                  />
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>
                    Lo encontrás en Mercado Pago → Tu negocio → Point → Detalles del dispositivo.
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm">Guardar Point</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={desconectar}>
                    Desconectar cuenta
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaFactura({ negocio, esDueno }) {
  const [conexion, setConexion] = useState(null); // fila facturacion_conexion
  const [estado, setEstado] = useState(null); // estado remoto (ARCA/MP en Facturá)
  const [aviso, setAviso] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(false);

  async function cargar() {
    const { data } = await supabase
      .from('facturacion_conexion')
      .select('conectado, factura_negocio_id, expira_en, conectado_en')
      .maybeSingle();
    setConexion(data || null);
    if (data?.conectado) cargarEstadoRemoto();
  }

  async function cargarEstadoRemoto() {
    setCargandoEstado(true);
    const { data: sesion } = await supabase.auth.getSession();
    const token = sesion?.session?.access_token;
    if (!token || !negocio?.id) return setCargandoEstado(false);
    try {
      const res = await fetch(
        `/api/facturacion/estado?negocio=${negocio.id}&token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      setEstado(data);
    } catch {
      /* se muestra igual el estado local */
    }
    setCargandoEstado(false);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('factura') === 'ok') {
      setAviso({ tipo: 'ok', texto: '¡Cuenta de Facturá conectada! Completá los 2 pasos de abajo.' });
    } else if (params.get('factura') === 'error') {
      setAviso({
        tipo: 'error',
        texto: `No se pudo conectar: ${params.get('detalle') || 'error desconocido'}. Probá de nuevo.`,
      });
    }
  }, []);

  useEffect(() => {
    if (negocio?.id) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id]);

  async function conectar() {
    const { data: sesion } = await supabase.auth.getSession();
    const token = sesion?.session?.access_token;
    const email = sesion?.session?.user?.email || '';
    window.location.href = `/api/facturacion/conectar?negocio=${negocio?.id}&token=${encodeURIComponent(
      token
    )}&email=${encodeURIComponent(email)}`;
  }

  const conectado = conexion?.conectado;
  const arcaOk = estado?.facturacion?.arca_conectado;
  const mpOk = estado?.cobros?.mp_conectado;

  return (
    <div className="card">
      <h2>Facturación electrónica (Facturá)</h2>
      {aviso && (
        <div className={`alert alert-${aviso.tipo === 'ok' ? 'ok' : 'error'}`} style={{ marginBottom: 12 }}>
          {aviso.texto}
        </div>
      )}

      <p style={{ color: 'var(--text-dim)', marginBottom: 14 }}>
        La facturación en ARCA y los cobros con Mercado Pago se hacen a través de{' '}
        <strong>Facturá</strong>. Conectás una sola vez con el <strong>mismo email</strong>{' '}
        de tu cuenta y listo.
      </p>

      {!conectado ? (
        esDueno ? (
          <button className="btn" onClick={conectar}>
            Conectar con Facturá
          </button>
        ) : (
          <p style={{ color: 'var(--text-dim)' }}>
            Solo el dueño del negocio puede conectar Facturá.
          </p>
        )
      ) : (
        <>
          <div className="alert alert-ok" style={{ marginBottom: 14 }}>
            Cuenta de Facturá vinculada.
          </div>

          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            Terminá la configuración dentro de Facturá:
          </p>
          <div className="carrito-item">
            <div className="info">
              <div>1 · Conectar Mercado Pago</div>
              <div className="meta">Para cobrar a tus clientes con QR / link</div>
            </div>
            <span className="pill" style={{ color: mpOk ? 'var(--accent)' : 'var(--warn)', borderColor: mpOk ? 'var(--accent)' : 'var(--warn)' }}>
              {cargandoEstado ? '…' : mpOk ? 'Listo' : 'Pendiente'}
            </span>
          </div>
          <div className="carrito-item">
            <div className="info">
              <div>2 · Autorizar ARCA</div>
              <div className="meta">Delegás el CUIT a Facturá, sin certificados</div>
            </div>
            <span className="pill" style={{ color: arcaOk ? 'var(--accent)' : 'var(--warn)', borderColor: arcaOk ? 'var(--accent)' : 'var(--warn)' }}>
              {cargandoEstado ? '…' : arcaOk ? 'Listo' : 'Pendiente'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <a
              className="btn"
              href="https://factura-app.netlify.app/configuracion"
              target="_blank"
              rel="noreferrer"
            >
              Abrir Facturá
            </a>
            <button className="btn btn-secondary btn-sm" onClick={cargarEstadoRemoto} disabled={cargandoEstado}>
              {cargandoEstado ? <span className="spinner" /> : 'Actualizar estado'}
            </button>
          </div>

          {arcaOk && mpOk && (
            <p style={{ color: 'var(--accent)', marginTop: 12, fontSize: '0.9rem' }}>
              Todo listo: ya podés facturar y cobrar desde Soporte Móvil.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaNotificaciones() {
  const [estado, setEstado] = useState('cargando'); // cargando | off | on | nosoporta
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!pushSoportado()) {
      setEstado('nosoporta');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'on' : 'off'))
      .catch(() => setEstado('off'));
  }, []);

  async function activar() {
    setAviso(null);
    try {
      const sub = await suscribirPush();
      const { data: u } = await supabase.auth.getUser();
      const { data: neg } = await supabase
        .from('negocios')
        .select('id')
        .maybeSingle();
      const { error } = await supabase.from('push_suscripciones').upsert(
        {
          negocio_id: neg.id,
          user_id: u.user.id,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        { onConflict: 'endpoint' }
      );
      if (error) throw new Error(error.message);
      setEstado('on');
      setAviso({ tipo: 'ok', texto: 'Notificaciones activadas en este dispositivo.' });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e.message });
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Notificaciones</h2>
      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>
          {aviso.texto}
        </div>
      )}
      {estado === 'nosoporta' ? (
        <p style={{ color: 'var(--text-dim)' }}>
          Este navegador no soporta notificaciones push.
        </p>
      ) : estado === 'on' ? (
        <p style={{ color: 'var(--accent)', fontWeight: 600 }}>
          Activadas: vas a recibir un aviso en este dispositivo cada vez que
          entre una orden nueva.
        </p>
      ) : (
        <>
          <p style={{ color: 'var(--text-dim)', marginBottom: 14 }}>
            Recibí un aviso en este dispositivo cada vez que un cliente cree
            una orden nueva, aunque tengas la app cerrada. Consejo: en el
            celular, primero instalá la app ("Agregar a pantalla de inicio").
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={activar}
            disabled={estado === 'cargando'}
          >
            Activar notificaciones
          </button>
        </>
      )}
    </div>
  );
}

function TarjetaComprobantes({ esDueno }) {
  const [form, setForm] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from('comprobante_config')
      .select('*')
      .maybeSingle()
      .then(({ data }) =>
        setForm({
          plantilla: data?.plantilla || 'a4_doble',
          encabezado: data?.encabezado || '',
          pie: data?.pie || '',
          mostrar_montos: data?.mostrar_montos ?? true,
        })
      );
  }, []);

  const set = (campo) => (e) =>
    setForm({
      ...form,
      [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    });

  async function guardar(e) {
    e.preventDefault();
    setAviso(null);
    setGuardando(true);
    const { data: neg } = await supabase.from('negocios').select('id').maybeSingle();
    const { error } = await supabase.from('comprobante_config').upsert(
      {
        negocio_id: neg.id,
        plantilla: form.plantilla,
        encabezado: form.encabezado || null,
        pie: form.pie || null,
        mostrar_montos: form.mostrar_montos,
      },
      { onConflict: 'negocio_id' }
    );
    setGuardando(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else setAviso({ tipo: 'ok', texto: 'Comprobante guardado. Se aplica a las próximas impresiones.' });
  }

  if (!form) return <CargaTarjeta />;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Comprobante de orden</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 14 }}>
        Elegí el formato del comprobante que se imprime (o se guarda como PDF)
        al crear una orden, y personalizá el encabezado y las condiciones.
      </p>
      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>
          {aviso.texto}
        </div>
      )}
      {!esDueno ? (
        <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede configurar los comprobantes.</p>
      ) : (
        <form onSubmit={guardar}>
          <div className="grid-2">
            <div className="field">
              <label>Plantilla</label>
              <select value={form.plantilla} onChange={set('plantilla')}>
                <option value="a4_doble">A4 — talón cliente + copia taller (con línea de corte)</option>
                <option value="a4_simple">A4 — hoja simple</option>
                <option value="ticket_80mm">Ticket 80mm (impresora térmica)</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label>
                <input
                  type="checkbox"
                  checked={form.mostrar_montos}
                  onChange={set('mostrar_montos')}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                Mostrar presupuesto y señas en el comprobante
              </label>
            </div>
          </div>
          <div className="field">
            <label>Encabezado (dirección, teléfono, CUIT — un dato por línea)</label>
            <textarea
              value={form.encabezado}
              onChange={set('encabezado')}
              style={{ minHeight: 64 }}
              placeholder={'Av. Siempre Viva 123, CABA\nTel: 11 5555-5555\nCUIT 20-12345678-9'}
            />
          </div>
          <div className="field">
            <label>Pie / condiciones de servicio</label>
            <textarea
              value={form.pie}
              onChange={set('pie')}
              style={{ minHeight: 64 }}
              placeholder="Pasados 30 días de avisada la reparación, el equipo se considera abandonado..."
            />
          </div>
          <button className="btn" disabled={guardando}>
            {guardando ? <span className="spinner" /> : 'Guardar comprobante'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ConfigPage() {
  const { esDueno } = usePerfil();
  const [negocio, setNegocio] = useState(null);

  useEffect(() => {
    supabase
      .from('negocios')
      .select('*')
      .maybeSingle()
      .then(({ data }) => setNegocio(data));
  }, []);

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Configuración</h1>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <TarjetaMercadoPago negocio={negocio} esDueno={esDueno} />
        <TarjetaFactura negocio={negocio} esDueno={esDueno} />
      </div>
      <TarjetaComprobantes esDueno={esDueno} />
      <TarjetaNotificaciones />
    </main>
  );
}
