'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PerfilContext } from '@/lib/panel-context';
import { registrarSW } from '@/lib/push';
import { BuscadorGlobal } from '@/components/buscador';
import { PantallaCarga } from '@/components/cargando';
import { Icon } from '@/components/icons';

const GRUPOS = [
  {
    titulo: 'Operación',
    links: [
      ['/panel', 'Dashboard', 'dashboard'],
      ['/panel/pos', 'POS', 'pos'],
      ['/panel/ventas', 'Ventas', 'ventas'],
      ['/panel/presupuestos', 'Presupuestos', 'presupuestos'],
      ['/panel/tickets', 'Órdenes', 'ordenes'],
      ['/panel/caja', 'Caja', 'caja'],
      ['/panel/clientes', 'Clientes', 'clientes'],
    ],
  },
  {
    titulo: 'Catálogo',
    links: [
      ['/panel/inventario', 'Inventario', 'inventario'],
      ['/panel/servicios', 'Servicios', 'servicios'],
    ],
  },
  {
    titulo: 'Comunicación',
    soloBot: true,
    links: [['/panel/whatsapp', 'WhatsApp', 'whatsapp']],
  },
  {
    titulo: 'Análisis',
    soloDueno: true,
    links: [
      ['/panel/reportes', 'Reportes', 'reportes'],
      ['/panel/fidelizacion', 'Fidelización', 'fidelizacion'],
      ['/panel/usuarios', 'Usuarios', 'usuarios'],
    ],
  },
  {
    titulo: 'Cuenta',
    links: [
      ['/panel/config', 'Configuración', 'config'],
      ['/panel/importar', 'Importar datos', 'importar'],
      ['/panel/plan', 'Mi plan', 'plan'],
    ],
  },
];

function Login() {
  const [modo, setModo] = useState('login'); // login | recuperar
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setCargando(false);
    if (err) setError('Credenciales incorrectas.');
  }

  async function recuperar(e) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    if (!email.trim()) return setError('Ingresá tu email.');
    setCargando(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/panel`,
    });
    setCargando(false);
    if (err) setError(err.message);
    else
      setAviso(
        `Si ${email.trim()} tiene una cuenta, te enviamos un email para restablecer la contraseña.`
      );
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="login-head">
          <div className="login-logo"><Icon name="pos" size={30} /></div>
          <div className="login-brand">Soporte <span>Móvil</span></div>
          <div className="login-sub">
            {modo === 'login' ? 'Sistema de gestión del taller' : 'Recuperá tu contraseña'}
          </div>
        </div>
        <div className="login-body">
        {error && <div className="alert alert-error">{error}</div>}
        {aviso && <div className="alert alert-ok">{aviso}</div>}

        {modo === 'login' ? (
          <>
            <form onSubmit={entrar}>
              <div className="field">
                <label>Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@soportemovil.com.ar"
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button className="btn" style={{ width: '100%' }} disabled={cargando}>
                {cargando ? <span className="spinner" /> : 'Ingresar'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.85rem' }}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setModo('recuperar');
                  setError(null);
                  setAviso(null);
                }}
              >
                ¿Olvidaste tu contraseña?
              </a>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={recuperar}>
              <div className="field">
                <label>Email de tu cuenta</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <button className="btn" style={{ width: '100%' }} disabled={cargando}>
                {cargando ? <span className="spinner" /> : 'Enviar link de recuperación'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.85rem' }}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setModo('login');
                  setError(null);
                  setAviso(null);
                }}
              >
                ← Volver a ingresar
              </a>
            </p>
          </>
        )}
        </div>
      </div>
    </main>
  );
}

// Pantalla para fijar una contraseña nueva tras el link de recuperación.
function NuevaClave({ onListo }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setCargando(false);
    if (err) setError(err.message);
    else onListo();
  }

  return (
    <main>
      <div className="hero">
        <h1>
          Nueva <em>contraseña</em>
        </h1>
        <p>Elegí una contraseña nueva para tu cuenta.</p>
      </div>
      <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={guardar}>
          <div className="field">
            <label>Contraseña nueva (mínimo 6)</label>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn" style={{ width: '100%' }} disabled={cargando}>
            {cargando ? <span className="spinner" /> : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function PanelLayout({ children }) {
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [negocio, setNegocio] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') setRecuperando(true);
      setSesion(s);
    });
    registrarSW().catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);

  // cerrar el drawer al navegar
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      setNegocio(null);
      return;
    }
    supabase
      .from('perfiles')
      .select('*')
      .eq('user_id', sesion.user.id)
      .maybeSingle()
      .then(({ data }) => setPerfil(data));
    supabase
      .from('negocios')
      .select('*')
      .maybeSingle()
      .then(({ data }) => setNegocio(data));
  }, [sesion]);

  const diasTrial =
    negocio?.plan === 'trial'
      ? Math.max(
          0,
          Math.ceil(
            (new Date(negocio.trial_hasta) - Date.now()) / 86400000
          )
        )
      : null;

  if (sesion === undefined) {
    return <PantallaCarga />;
  }

  if (recuperando) return <NuevaClave onListo={() => setRecuperando(false)} />;

  if (!sesion) return <Login />;

  const gruposVisibles = GRUPOS.filter(
    (g) =>
      (!g.soloDueno || perfil?.rol === 'dueno') &&
      (!g.soloBot || negocio?.bot_ia)
  );

  const contenidoSidebar = (
    <>
      <div className="sidebar-brand">
        <div className="brand-name">
          Soporte <span>Móvil</span>
        </div>
        <div className="brand-sub">Sistema de gestión</div>
        {negocio && (
          <div className="brand-negocio">
            {negocio.nombre}
            {diasTrial !== null && (
              <span className="pill" style={{ color: 'var(--warn)', borderColor: 'var(--warn)', marginLeft: 8 }}>
                Prueba: {diasTrial} días
              </span>
            )}
          </div>
        )}
      </div>

      <BuscadorGlobal />

      <nav className="sidebar-nav">
        {gruposVisibles.map((g) => (
          <div className="sidebar-group" key={g.titulo}>
            <div className="sidebar-titulo">{g.titulo}</div>
            {g.links.map(([href, label, icono]) => (
              <Link
                key={href}
                href={href}
                className={`side-link ${pathname === href ? 'active' : ''}`}
              >
                <Icon name={icono} size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="user-chip">
          <span className="user-avatar">
            {(perfil?.nombre || '?').slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{perfil?.nombre || '...'}</strong>
            <small>{perfil?.rol === 'dueno' ? 'Dueño' : 'Operador'}</small>
          </span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={() => supabase.auth.signOut()}
        >
          <Icon name="logout" size={16} />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <PerfilContext.Provider value={{ perfil, esDueno: perfil?.rol === 'dueno' }}>
      {/* Barra superior — solo móvil */}
      <div className="topbar">
        <button
          className="topbar-btn"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
        >
          <Icon name="menu" size={22} />
        </button>
        <div className="topbar-brand">
          Soporte <span>Móvil</span>
        </div>
        <span className="user-avatar">
          {(perfil?.nombre || '?').slice(0, 1).toUpperCase()}
        </span>
      </div>

      {/* Drawer móvil */}
      {menuAbierto && (
        <div className="drawer-overlay" onClick={() => setMenuAbierto(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <button
              className="drawer-close"
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
            >
              <Icon name="close" size={22} />
            </button>
            {contenidoSidebar}
          </aside>
        </div>
      )}

      <div className="panel-shell">
        <aside className="sidebar">{contenidoSidebar}</aside>

        <div className="panel-main">
          {negocio &&
          negocio.plan === 'trial' &&
          new Date(negocio.trial_hasta) < Date.now() &&
          pathname !== '/panel/plan' ? (
            <main>
              <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
                <h2>Tu prueba gratis terminó</h2>
                <p style={{ color: 'var(--text-dim)', marginBottom: 18 }}>
                  Tus datos están intactos. Suscribite al Plan Pro para seguir
                  operando: órdenes, ventas y usuarios ilimitados.
                </p>
                <Link className="btn" href="/panel/plan">
                  Ver planes y suscribirme
                </Link>
              </div>
            </main>
          ) : (
            children
          )}
        </div>
      </div>
    </PerfilContext.Provider>
  );
}
