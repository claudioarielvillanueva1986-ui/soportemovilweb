'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase, ESTADOS, formatMoney } from '@/lib/supabase';

// Búsqueda global del panel: órdenes, clientes y productos en un solo lugar.
export function BuscadorGlobal() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const timer = useRef(null);
  const cont = useRef(null);

  useEffect(() => {
    function fuera(e) {
      if (cont.current && !cont.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function cambiar(e) {
    const valor = e.target.value;
    setQ(valor);
    clearTimeout(timer.current);
    if (valor.trim().length < 2) {
      setRes(null);
      return;
    }
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc('buscar_global', { p_q: valor });
      setRes(data);
      setAbierto(true);
    }, 300);
  }

  const hayResultados =
    res &&
    (res.ordenes.length > 0 || res.clientes.length > 0 || res.productos.length > 0);

  return (
    <div className="buscador" ref={cont}>
      <input
        value={q}
        onChange={cambiar}
        onFocus={() => res && setAbierto(true)}
        placeholder="Buscar orden, cliente o producto..."
      />
      {abierto && res && (
        <div className="buscador-panel">
          {!hayResultados && (
            <div className="buscador-vacio">Sin resultados para “{q}”</div>
          )}
          {res.ordenes.length > 0 && (
            <div className="buscador-grupo">
              <div className="buscador-titulo">Órdenes</div>
              {res.ordenes.map((o) => (
                <a
                  key={o.id}
                  className="buscador-item"
                  href={`/panel/tickets?buscar=${encodeURIComponent(o.numero)}`}
                >
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                    {o.numero}
                  </span>{' '}
                  {o.nombre} · {o.equipo}
                  <span
                    className="pill"
                    style={{
                      marginLeft: 'auto',
                      color: ESTADOS[o.estado]?.color,
                      borderColor: `${ESTADOS[o.estado]?.color}66`,
                    }}
                  >
                    {ESTADOS[o.estado]?.label || o.estado}
                  </span>
                </a>
              ))}
            </div>
          )}
          {res.clientes.length > 0 && (
            <div className="buscador-grupo">
              <div className="buscador-titulo">Clientes</div>
              {res.clientes.map((c) => (
                <a
                  key={c.id}
                  className="buscador-item"
                  href={`/panel/clientes?buscar=${encodeURIComponent(c.nombre)}`}
                >
                  {c.nombre}
                  <span className="meta" style={{ marginLeft: 'auto' }}>
                    {c.telefono || c.email || ''}
                  </span>
                </a>
              ))}
            </div>
          )}
          {res.productos.length > 0 && (
            <div className="buscador-grupo">
              <div className="buscador-titulo">Productos</div>
              {res.productos.map((p) => (
                <a
                  key={p.id}
                  className="buscador-item"
                  href={`/panel/inventario?buscar=${encodeURIComponent(p.nombre)}`}
                >
                  {p.nombre}
                  <span className="meta" style={{ marginLeft: 'auto' }}>
                    {p.maneja_stock ? `stock ${p.stock} · ` : ''}
                    {formatMoney(p.precio)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
