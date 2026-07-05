'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PerfilContext } from '@/lib/panel-context';
import { registrarSW } from '@/lib/push';
import { BuscadorGlobal } from '@/components/buscador';
import { PantallaCarga } from '@/components/cargando';

const GRUPOS = [
  {
    titulo: 'Operación',
    links: [
      ['/panel', 'Dashboard'],
      ['/panel/pos', 'POS'],
      ['/panel/tickets', 'Órdenes'],
      ['/panel/caja', 'Caja'],
      ['/panel/clientes', 'Clientes'],
    ],
  },
  {
    titulo: 'Catálogo',
    links: [['/panel/inventario', 'Inventario']],
  },
  {
    titulo: 'Análisis',
    soloDueno: true,
    links: [['/panel/reportes', 'Reportes']],
  },
  {
    titulo: 'Cuenta',
    links: [
      ['/panel/config', 'Configuración'],
      ['/panel/plan', 'Mi plan'],
    ],
  },
];

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
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

  return (
    <main>
      <div className="hero">
        <h1>
          Panel de <em>Soporte Móvil</em>
        </h1>
        <p>Acceso exclusivo para el equipo.</p>
      </div>
      <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
        {error && <div className="alert alert-error">{error}</div>}
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
      </div>
    </main>
  );
}

export default function PanelLayout({ children }) {
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [negocio, setNegocio] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) =>
      setSesion(s)
    );
    registrarSW().catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);

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

  if (!sesion) return <Login />;

  return (
    <PerfilContext.Provider
      value={{ perfil, esDueno: perfil?.rol === 'dueno' }}
    >
      <div className="panel-shell">
        <aside className="sidebar">
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

          {GRUPOS.filter(
            (g) => !g.soloDueno || perfil?.rol === 'dueno'
          ).map((g) => (
            <div className="sidebar-group" key={g.titulo}>
              <div className="sidebar-titulo">{g.titulo}</div>
              {g.links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className={`side-link ${pathname === href ? 'active' : ''}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}

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
              Cerrar sesión
            </button>
          </div>
        </aside>

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
