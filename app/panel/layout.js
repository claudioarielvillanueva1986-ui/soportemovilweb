'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PerfilContext } from '@/lib/panel-context';

const SECCIONES = [
  ['/panel', '📊 Resumen'],
  ['/panel/pos', '🛒 POS'],
  ['/panel/caja', '💵 Caja'],
  ['/panel/inventario', '📦 Inventario'],
  ['/panel/clientes', '👥 Clientes'],
  ['/panel/tickets', '🔧 Reparaciones'],
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
              placeholder="admin@soportemovil.com.ar"
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
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) =>
      setSesion(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      return;
    }
    supabase
      .from('perfiles')
      .select('*')
      .eq('user_id', sesion.user.id)
      .maybeSingle()
      .then(({ data }) => setPerfil(data));
  }, [sesion]);

  if (sesion === undefined) {
    return (
      <main style={{ textAlign: 'center', padding: 60 }}>
        <span className="spinner" />
      </main>
    );
  }

  if (!sesion) return <Login />;

  return (
    <PerfilContext.Provider
      value={{ perfil, esDueno: perfil?.rol === 'dueno' }}
    >
      <div className="panel-top">
        <nav className="panel-nav">
          {SECCIONES.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`panel-tab ${pathname === href ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="panel-user">
          <span className="panel-rol">
            {perfil ? (perfil.rol === 'dueno' ? '👑 ' : '🧑‍🔧 ') + perfil.nombre : '...'}
          </span>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => supabase.auth.signOut()}
          >
            Salir
          </button>
        </div>
      </div>
      {children}
    </PerfilContext.Provider>
  );
}
