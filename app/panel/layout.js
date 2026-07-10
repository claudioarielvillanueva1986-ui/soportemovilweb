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
import { NotificacionesCentro } from '@/components/notificaciones';

// Agrupación calcada de la de v1 (Operación / Catálogo / Análisis): los
// módulos que v1 también tiene van en el mismo grupo y orden. Lo que v2
// suma de más (MDM, Tienda, Fidelización, Cupones, Encuestas...) se
// intercala al final de su grupo más afín, sin inventar entradas para
// módulos de v1 que todavía no están portados (Reactivación, Inteligencia
// ventas, Reporte margen, Historial, Gastos).
const GRUPOS = [
  {
    titulo: 'Operación',
    links: [
      ['/panel', 'Dashboard', 'dashboard'],
      ['/panel/pos', 'POS', 'pos'],
      ['/panel/tickets', 'Órdenes', 'ordenes'],
      ['/panel/whatsapp', 'WhatsApp', 'whatsapp', { soloBot: true }],
      ['/panel/caja', 'Caja', 'caja'],
      ['/panel/clientes', 'Clientes', 'clientes'],
      ['/panel/mdm', 'MDM (equipos vendidos)', 'mdm'],
    ],
  },
  {
    titulo: 'Catálogo',
    links: [
      ['/panel/inventario', 'Inventario', 'inventario'],
      ['/panel/presupuestos', 'Presupuestos', 'presupuestos'],
      ['/panel/servicios', 'Servicios', 'servicios'],
    ],
  },
  {
    titulo: 'Tienda',
    links: [
      ['/panel/pedidos', 'Pedidos', 'pedidos'],
      ['/panel/tienda', 'Mi tienda', 'tienda'],
    ],
  },
  {
    titulo: 'Análisis',
    soloDueno: true,
    links: [
      ['/panel/reportes', 'Reportes', 'reportes'],
      ['/panel/inteligencia', 'Inteligencia de ventas', 'inteligencia'],
      ['/panel/ventas', 'Ventas', 'ventas'],
      ['/panel/fidelizacion', 'Fidelización', 'fidelizacion'],
      ['/panel/cupones', 'Cupones', 'cupones'],
      ['/panel/encuestas', 'Encuestas', 'encuestas'],
      ['/panel/usuarios', 'Usuarios', 'usuarios'],
    ],
  },
  {
    titulo: 'Cuenta',
    links: [
      ['/panel/config', 'Configuración', 'config'],
      ['/panel/importar', 'Importar datos', 'importar'],
    ],
  },
];

const BOTTOM_NAV = [
  ['/panel', 'Inicio', 'dashboard'],
  ['/panel/tickets', 'Órdenes', 'ordenes'],
  ['/panel/whatsapp', 'WhatsApp', 'whatsapp'],
  ['/panel/clientes', 'Clientes', 'clientes'],
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
          <img src="/logo-dark.png" alt="Soporte Móvil" style={{ height: 48, width: 'auto', display: 'block', margin: '0 auto 10px' }} />
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

  if (sesion === undefined) {
    return <PantallaCarga />;
  }

  if (recuperando) return <NuevaClave onListo={() => setRecuperando(false)} />;

  if (!sesion) return <Login />;

  const gruposVisibles = GRUPOS.filter((g) => !g.soloDueno || perfil?.rol === 'dueno')
    .map((g) => ({
      ...g,
      links: g.links.filter(([, , , opts]) => !opts?.soloBot || negocio?.bot_ia),
    }))
    .filter((g) => g.links.length > 0);

  const contenidoSidebar = (
    <>
      <div className="sidebar-brand">
        <img src="/logo-dark.png" alt="Soporte Móvil" style={{ height: 30, width: 'auto', display: 'block' }} />
        <div className="brand-sub">Sistema de gestión</div>
        {negocio && <div className="brand-negocio">{negocio.nombre}</div>}
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
      {negocio?.id && <NotificacionesCentro negocioId={negocio.id} />}
      {/* Barra superior — solo móvil */}
      <div className="topbar">
        <button
          className="topbar-btn"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
        >
          <Icon name="menu" size={22} />
        </button>
        <span className="topbar-brand">
          <img src="/logo-dark.png" alt="Soporte Móvil" style={{ height: 22, width: 'auto', display: 'block' }} />
        </span>
        <span className="user-avatar" style={{ marginRight: 34 }}>
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

        <div className="panel-main">{children}</div>
      </div>

      {/* Bottom-nav — solo móvil, calcado de v1 */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.filter(([href]) => href !== '/panel/whatsapp' || negocio?.bot_ia).map(
          ([href, label, icono]) => (
            <Link
              key={href}
              href={href}
              className={`bn-item ${pathname === href || (href !== '/panel' && pathname.startsWith(href)) ? 'active' : ''}`}
            >
              <Icon name={icono} size={20} />
              <span>{label}</span>
            </Link>
          )
        )}
        <button
          className={`bn-item ${menuAbierto ? 'active' : ''}`}
          onClick={() => setMenuAbierto(true)}
          aria-label="Más opciones"
        >
          <Icon name="menu" size={20} />
          <span>Más</span>
        </button>
      </nav>
    </PerfilContext.Provider>
  );
}
