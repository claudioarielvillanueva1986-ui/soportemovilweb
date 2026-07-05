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
            <a className="btn" href={`/api/mp/oauth/conectar?negocio=${negocio?.id}`}>
              Conectar con Mercado Pago
            </a>
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

function TarjetaArca({ esDueno }) {
  const [estado, setEstado] = useState(null);
  const [form, setForm] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await supabase.rpc('arca_estado');
    setEstado(data);
    setForm({
      modo: data?.modo || 'deshabilitado',
      cuit: data?.cuit || '',
      razon_social: data?.razon_social || '',
      condicion_iva: data?.condicion_iva || 'monotributo',
      punto_venta: data?.punto_venta || '',
      cert_pem: '',
      key_pem: '',
    });
  }

  useEffect(() => {
    cargar();
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setAviso(null);
    setGuardando(true);
    const { error } = await supabase.rpc('arca_guardar', {
      p_modo: form.modo,
      p_cuit: form.cuit.replace(/\D/g, '') || null,
      p_razon_social: form.razon_social,
      p_condicion_iva: form.condicion_iva,
      p_punto_venta: Number(form.punto_venta) || null,
      p_cert_pem: form.cert_pem || null,
      p_key_pem: form.key_pem || null,
    });
    setGuardando(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else {
      setAviso({ tipo: 'ok', texto: 'Configuración de facturación guardada.' });
      cargar();
    }
  }

  if (!estado || !form) return <CargaTarjeta lineas={5} />;

  return (
    <div className="card">
      <h2>Facturación electrónica (ARCA)</h2>
      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>
          {aviso.texto}
        </div>
      )}

      <p style={{ color: 'var(--text-dim)', marginBottom: 14 }}>
        Completá los datos fiscales de tu negocio para emitir comprobantes
        desde el sistema. Empezá en <strong>modo homologación</strong> (prueba)
        y pasá a producción cuando verifiques que todo sale bien.
      </p>

      {!esDueno ? (
        <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede configurar la facturación.</p>
      ) : (
        <form onSubmit={guardar}>
          <div className="grid-2">
            <div className="field">
              <label>Estado</label>
              <select value={form.modo} onChange={set('modo')}>
                <option value="deshabilitado">Deshabilitada</option>
                <option value="homologacion">Homologación (prueba)</option>
                <option value="produccion">Producción</option>
              </select>
            </div>
            <div className="field">
              <label>CUIT (11 números, sin guiones)</label>
              <input
                value={form.cuit}
                onChange={set('cuit')}
                placeholder="20123456789"
                maxLength={13}
              />
            </div>
            <div className="field">
              <label>Razón social</label>
              <input value={form.razon_social} onChange={set('razon_social')} />
            </div>
            <div className="field">
              <label>Condición frente al IVA</label>
              <select value={form.condicion_iva} onChange={set('condicion_iva')}>
                <option value="monotributo">Monotributo</option>
                <option value="responsable_inscripto">Responsable inscripto</option>
                <option value="exento">Exento</option>
              </select>
            </div>
            <div className="field">
              <label>Punto de venta (webservice)</label>
              <input
                type="number"
                min="1"
                value={form.punto_venta}
                onChange={set('punto_venta')}
                placeholder="Ej: 2"
              />
            </div>
          </div>

          <div className="field">
            <label>
              Certificado digital (.crt / .pem)
              {estado.tiene_certificado ? ' — ya cargado, pegá uno solo si querés reemplazarlo' : ''}
            </label>
            <textarea
              value={form.cert_pem}
              onChange={set('cert_pem')}
              placeholder="-----BEGIN CERTIFICATE-----"
              style={{ minHeight: 70, fontFamily: 'var(--mono)', fontSize: '0.75rem' }}
            />
          </div>
          <div className="field">
            <label>Clave privada (.key)</label>
            <textarea
              value={form.key_pem}
              onChange={set('key_pem')}
              placeholder="-----BEGIN PRIVATE KEY-----"
              style={{ minHeight: 70, fontFamily: 'var(--mono)', fontSize: '0.75rem' }}
            />
          </div>

          <button className="btn" disabled={guardando}>
            {guardando ? <span className="spinner" /> : 'Guardar facturación'}
          </button>

          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 14 }}>
            ¿No tenés el certificado? Se genera gratis en el sitio de ARCA
            (Administrador de Certificados Digitales) con tu clave fiscal, y el
            punto de venta se crea en "Comprobantes en línea → ABM Puntos de
            Venta" eligiendo "Factura Electrónica - Webservice". Son 10 minutos
            por única vez.
          </p>
        </form>
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
        <TarjetaArca esDueno={esDueno} />
      </div>
      <TarjetaComprobantes esDueno={esDueno} />
      <TarjetaNotificaciones />
    </main>
  );
}
