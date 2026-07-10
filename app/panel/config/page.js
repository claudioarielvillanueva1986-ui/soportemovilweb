'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { pushSoportado, suscribirPush } from '@/lib/push';
import { CargaTarjeta } from '@/components/cargando';

function TarjetaFactura({ negocio, esDueno }) {
  const [conexion, setConexion] = useState(null); // fila facturacion_conexion
  const [estado, setEstado] = useState(null); // estado remoto (ARCA/MP en Facturá)
  const [aviso, setAviso] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [autoFactura, setAutoFactura] = useState(false);

  useEffect(() => {
    if (negocio) setAutoFactura(!!negocio.facturar_auto);
  }, [negocio]);

  async function toggleAuto(valor) {
    setAutoFactura(valor);
    const { error } = await supabase.rpc('set_facturar_auto', { p_valor: valor });
    if (error) {
      setAutoFactura(!valor);
      setAviso({ tipo: 'error', texto: error.message });
    }
  }

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

          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>
                <strong>Facturar automáticamente al cobrar</strong>
                <br />
                <small style={{ color: 'var(--text-dim)' }}>
                  Si está apagado, facturás manualmente con el botón "Facturar" en cada venta.
                </small>
              </span>
              <input
                type="checkbox"
                checked={autoFactura}
                disabled={!esDueno}
                onChange={(e) => toggleAuto(e.target.checked)}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function TarjetaCuenta() {
  const [emailActual, setEmailActual] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevaClave, setNuevaClave] = useState('');
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmailActual(data?.user?.email || ''));
  }, []);

  async function cambiarEmail(e) {
    e.preventDefault();
    setAviso(null);
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({ email: nuevoEmail.trim() });
    setOcupado(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else {
      setAviso({
        tipo: 'ok',
        texto: `Te enviamos un email a ${nuevoEmail.trim()} para confirmar el cambio. El email nuevo queda activo recién cuando confirmás desde ese link.`,
      });
      setNuevoEmail('');
    }
  }

  async function cambiarClave(e) {
    e.preventDefault();
    setAviso(null);
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({ password: nuevaClave });
    setOcupado(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else {
      setAviso({ tipo: 'ok', texto: 'Contraseña actualizada.' });
      setNuevaClave('');
    }
  }

  return (
    <div className="card">
      <h2>Mi cuenta</h2>
      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>
          {aviso.texto}
        </div>
      )}

      <form onSubmit={cambiarEmail}>
        <div className="field">
          <label>Email de acceso</label>
          <input
            type="email"
            required
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            placeholder={emailActual || 'tu@email.com'}
          />
          {emailActual && (
            <small style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>
              Actual: {emailActual}
            </small>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" disabled={ocupado}>
          {ocupado ? <span className="spinner" /> : 'Cambiar email'}
        </button>
      </form>

      <form onSubmit={cambiarClave} style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div className="field">
          <label>Nueva contraseña (mínimo 6)</label>
          <input
            type="password"
            required
            minLength={6}
            value={nuevaClave}
            onChange={(e) => setNuevaClave(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary btn-sm" disabled={ocupado}>
          {ocupado ? <span className="spinner" /> : 'Cambiar contraseña'}
        </button>
      </form>
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

function TarjetaDatosTaller({ negocio, esDueno }) {
  const [wa, setWa] = useState('');
  const [dir, setDir] = useState('');
  const [hor, setHor] = useState('');
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!negocio) return;
    setWa(negocio.wa_publico || '');
    setDir(negocio.direccion || '');
    setHor(negocio.horario || '');
  }, [negocio]);

  async function guardar(e) {
    e.preventDefault();
    setAviso(null);
    setGuardando(true);
    const { error } = await supabase.rpc('set_datos_taller', { p_whatsapp: wa, p_direccion: dir, p_horario: hor });
    setGuardando(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else setAviso({ tipo: 'ok', texto: 'Datos guardados. Se muestran a tus clientes en el seguimiento.' });
  }

  return (
    <div className="card">
      <h2>Datos del taller (públicos)</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 12, fontSize: '.88rem' }}>
        Se muestran a tus clientes en la página de seguimiento de la orden, junto al botón de WhatsApp.
      </p>
      {aviso && <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{aviso.texto}</div>}
      {!esDueno ? (
        <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede editar estos datos.</p>
      ) : (
        <form onSubmit={guardar}>
          <div className="field">
            <label>WhatsApp de contacto (con código de área)</label>
            <input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="11 5555-5555" />
          </div>
          <div className="field">
            <label>Dirección</label>
            <input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Av. Siempre Viva 123" />
          </div>
          <div className="field">
            <label>Horario de atención</label>
            <input value={hor} onChange={(e) => setHor(e.target.value)} placeholder="Lun a Sáb 9 a 18" />
          </div>
          <button className="btn" disabled={guardando}>{guardando ? <span className="spinner" /> : 'Guardar datos'}</button>
        </form>
      )}
    </div>
  );
}

function TarjetaAvisos({ negocio, esDueno }) {
  const [recibido, setRecibido] = useState('');
  const [listo, setListo] = useState('');
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!negocio) return;
    setRecibido(
      negocio.wa_aviso_recibido ??
        'Hola {cliente}! 👋 Recibimos tu {equipo} en {taller}. Tu orden es {numero}. Te avisamos apenas esté lista. Podés seguirla acá: {link}'
    );
    setListo(
      negocio.wa_aviso_listo ??
        'Hola {cliente}! ✅ Tu {equipo} (orden {numero}) ya está listo para retirar en {taller}. ¡Te esperamos!'
    );
  }, [negocio]);

  async function guardar(e) {
    e.preventDefault();
    setAviso(null);
    setGuardando(true);
    const { error } = await supabase.rpc('set_avisos_whatsapp', {
      p_recibido: recibido,
      p_listo: listo,
    });
    setGuardando(false);
    if (error) setAviso({ tipo: 'error', texto: error.message });
    else setAviso({ tipo: 'ok', texto: 'Mensajes guardados.' });
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Avisos por WhatsApp</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
        Los mensajes que se abren al tocar <strong>“WhatsApp: recibido”</strong> y{' '}
        <strong>“WhatsApp: listo”</strong> en una orden. Podés usar estos comodines:{' '}
        <code>{'{cliente}'}</code> <code>{'{equipo}'}</code> <code>{'{numero}'}</code>{' '}
        <code>{'{taller}'}</code> <code>{'{link}'}</code>.
      </p>
      {aviso && (
        <div className={`alert ${aviso.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{aviso.texto}</div>
      )}
      {!esDueno ? (
        <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede editar los mensajes.</p>
      ) : (
        <form onSubmit={guardar}>
          <div className="field">
            <label>Cuando se recibe el equipo</label>
            <textarea value={recibido} onChange={(e) => setRecibido(e.target.value)} style={{ minHeight: 72 }} />
          </div>
          <div className="field">
            <label>Cuando está listo para retirar</label>
            <textarea value={listo} onChange={(e) => setListo(e.target.value)} style={{ minHeight: 72 }} />
          </div>
          <button className="btn" disabled={guardando}>
            {guardando ? <span className="spinner" /> : 'Guardar mensajes'}
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
      <h1 className="panel-h1">Configuración</h1>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <TarjetaFactura negocio={negocio} esDueno={esDueno} />
        <TarjetaComprobantes esDueno={esDueno} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <TarjetaDatosTaller negocio={negocio} esDueno={esDueno} />
        <TarjetaAvisos negocio={negocio} esDueno={esDueno} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <TarjetaCuenta />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <TarjetaNotificaciones />
      </div>
    </main>
  );
}
