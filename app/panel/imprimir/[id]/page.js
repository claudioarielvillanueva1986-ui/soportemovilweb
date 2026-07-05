'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, ESTADOS, formatMoney, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

// Un talón del comprobante (se usa para cliente y para copia del taller)
function Talon({ tipo, ticket, negocio, config, senas }) {
  const lineas = (config?.encabezado || '').split('\n').filter(Boolean);
  const esTaller = tipo === 'taller';
  return (
    <div className="comp-talon">
      <div className="comp-head">
        <div>
          <div className="comp-negocio">{negocio?.nombre}</div>
          {lineas.map((l, i) => (
            <div className="comp-sub" key={i}>
              {l}
            </div>
          ))}
        </div>
        <div className="comp-derecha">
          <div className="comp-tipo">
            {esTaller ? 'COPIA TALLER' : 'TALÓN CLIENTE'}
          </div>
          <div className="comp-numero">{ticket.numero}</div>
          <div className="comp-sub">{formatFecha(ticket.created_at)}</div>
        </div>
      </div>

      <div className="comp-grid">
        <div>
          <span className="comp-lbl">Cliente</span>
          {ticket.nombre}
        </div>
        <div>
          <span className="comp-lbl">Teléfono</span>
          {ticket.telefono || '—'}
        </div>
        <div>
          <span className="comp-lbl">Equipo</span>
          {ticket.dispositivo}
          {ticket.marca_modelo ? ` — ${ticket.marca_modelo}` : ''}
        </div>
        <div>
          <span className="comp-lbl">Estado</span>
          {ESTADOS[ticket.estado]?.label || ticket.estado}
        </div>
        {esTaller && ticket.equipo_password && (
          <div>
            <span className="comp-lbl">Clave equipo</span>
            {ticket.equipo_password}
          </div>
        )}
        {config?.mostrar_montos && ticket.presupuesto != null && (
          <div>
            <span className="comp-lbl">Presupuesto</span>
            {formatMoney(ticket.presupuesto)}
          </div>
        )}
        {config?.mostrar_montos && senas > 0 && (
          <div>
            <span className="comp-lbl">Seña abonada</span>
            {formatMoney(senas)}
          </div>
        )}
      </div>

      <div className="comp-falla">
        <span className="comp-lbl">Falla reportada</span>
        {ticket.descripcion}
      </div>

      {!esTaller && (
        <div className="comp-seguimiento">
          Seguí tu reparación online:{' '}
          <strong>
            {typeof window !== 'undefined' ? window.location.host : ''}/consulta
          </strong>
          {' '}con el número <strong>{ticket.numero}</strong>
          {ticket.email ? ` y tu email` : ''}
        </div>
      )}

      {config?.pie && <div className="comp-pie">{config.pie}</div>}

      <div className="comp-firmas">
        <div>
          <div className="comp-firma-linea" />
          Firma {esTaller ? 'del cliente' : 'del responsable'}
        </div>
        <div>
          <div className="comp-firma-linea" />
          Aclaración
        </div>
      </div>
    </div>
  );
}

export default function ImprimirPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: t, error: e1 }, { data: neg }, { data: cfg }, { data: pagos }] =
        await Promise.all([
          supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
          supabase.from('negocios').select('*').maybeSingle(),
          supabase.from('comprobante_config').select('*').maybeSingle(),
          supabase.from('ticket_pagos').select('monto').eq('ticket_id', id),
        ]);
      if (e1 || !t) {
        setError('No se encontró la orden.');
        return;
      }
      setDatos({
        ticket: t,
        negocio: neg,
        config: cfg || { plantilla: 'a4_doble', mostrar_montos: true },
        senas: (pagos || []).reduce((s, p) => s + Number(p.monto), 0),
      });
    })();
  }, [id]);

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!datos) return <PantallaCarga />;

  const { ticket, negocio, config, senas } = datos;
  const plantilla = config.plantilla || 'a4_doble';

  return (
    <main>
      <div className="no-imprimir" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <button className="btn" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
        <a className="btn btn-secondary btn-sm" href="/panel/tickets">
          Volver a órdenes
        </a>
        <a className="btn btn-secondary btn-sm" href="/panel/config">
          Configurar comprobante
        </a>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          Plantilla: {plantilla === 'a4_doble' ? 'A4 cliente + taller' : plantilla === 'a4_simple' ? 'A4 simple' : 'Ticket 80mm'}
        </span>
      </div>

      <div className={`comprobante ${plantilla === 'ticket_80mm' ? 'comp-80mm' : 'comp-a4'}`}>
        {plantilla === 'a4_doble' ? (
          <>
            <Talon tipo="cliente" ticket={ticket} negocio={negocio} config={config} senas={senas} />
            <div className="comp-corte">
              <span>✂</span> — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — cortar aquí
            </div>
            <Talon tipo="taller" ticket={ticket} negocio={negocio} config={config} senas={senas} />
          </>
        ) : (
          <Talon tipo="cliente" ticket={ticket} negocio={negocio} config={config} senas={senas} />
        )}
      </div>
    </main>
  );
}
