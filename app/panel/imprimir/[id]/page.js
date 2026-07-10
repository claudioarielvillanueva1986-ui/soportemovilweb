'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { supabase, ESTADOS, formatMoney, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

// Arma la lista de recepción para el talón del técnico — pantalla,
// condición general, cómo entró el equipo, accesorios y tipo de trabajo.
function checklistRecepcion(ticket) {
  const items = [];
  if (ticket.estado_pantalla) items.push(`Pantalla: ${ticket.estado_pantalla}`);
  if (ticket.condicion_general) items.push(`Condición: ${ticket.condicion_general}`);
  if (ticket.modo_ingreso?.length) items.push(`Ingresa: ${ticket.modo_ingreso.join(', ')}`);
  if (ticket.accesorios?.length) items.push(`Accesorios: ${ticket.accesorios.join(', ')}`);
  if (ticket.tipo_reparacion?.length) items.push(`Trabajo: ${ticket.tipo_reparacion.join(', ')}`);
  return items;
}

// Un talón del comprobante (se usa para cliente y para copia del taller)
function Talon({ tipo, ticket, negocio, config, senas, qr }) {
  const lineas = (config?.encabezado || '').split('\n').filter(Boolean);
  const esTaller = tipo === 'taller';
  return (
    <div className="comp-talon">
      <div className="comp-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="comp-logo">
            {(negocio?.nombre || '?').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div className="comp-negocio">{negocio?.nombre}</div>
            {lineas.map((l, i) => (
              <div className="comp-sub" key={i}>
                {l}
              </div>
            ))}
          </div>
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
          {ticket.color ? ` (${ticket.color})` : ''}
        </div>
        <div>
          <span className="comp-lbl">Estado</span>
          {ESTADOS[ticket.estado]?.label || ticket.estado}
        </div>
        {esTaller && ticket.imei_serial && (
          <div>
            <span className="comp-lbl">IMEI / Serial</span>
            {ticket.imei_serial}
          </div>
        )}
        {esTaller && ticket.equipo_password && (
          <div>
            <span className="comp-lbl">Clave equipo</span>
            {ticket.equipo_password}
          </div>
        )}
        {esTaller && ticket.tipo_reparacion?.length > 0 && (
          <div>
            <span className="comp-lbl">Tipo de reparación</span>
            {ticket.tipo_reparacion.join(', ')}
          </div>
        )}
        {!esTaller && ticket.accesorios?.length > 0 && (
          <div>
            <span className="comp-lbl">Accesorios que ingresa</span>
            {ticket.accesorios.join(', ')}
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
        {config?.mostrar_montos &&
          ticket.presupuesto != null &&
          Number(ticket.presupuesto) - senas > 0 && (
            <div>
              <span className="comp-lbl">Saldo pendiente</span>
              {formatMoney(Number(ticket.presupuesto) - senas)}
            </div>
          )}
      </div>

      <div className="comp-falla">
        <span className="comp-lbl">Falla reportada</span>
        {ticket.descripcion}
      </div>

      {esTaller && ticket.condicion_fisica && (
        <div className="comp-falla">
          <span className="comp-lbl">Condición física al recibir</span>
          {ticket.condicion_fisica}
        </div>
      )}

      {esTaller && checklistRecepcion(ticket).length > 0 && (
        <div className="comp-falla">
          <span className="comp-lbl">Checklist de recepción</span>
          {checklistRecepcion(ticket).join(' · ')}
        </div>
      )}

      <div className="comp-seguimiento" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {qr && (
          <img
            src={qr}
            alt="QR seguimiento"
            style={{ width: esTaller ? 56 : 84, height: esTaller ? 56 : 84, flexShrink: 0 }}
          />
        )}
        <span>
          Seguí tu reparación online:{' '}
          <strong>
            {typeof window !== 'undefined' ? window.location.host : ''}/consulta
          </strong>
          {' '}con el número <strong>{ticket.numero}</strong>
          {ticket.email ? ` y tu email` : ''}
        </span>
      </div>

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
  const searchParams = useSearchParams();
  const autoprint = searchParams.get('autoprint') === '1';
  const [datos, setDatos] = useState(null);
  const [qr, setQr] = useState(null);
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
      if (t.public_token) {
        const url = `${window.location.origin}/r/${t.public_token}`;
        QRCode.toDataURL(url, { margin: 1, width: 200 }).then(setQr).catch(() => {});
      }
    })();
  }, [id]);

  // Al venir de "crear orden e imprimir", dispara la impresión sola
  // (igual que v1: el operador no tiene que ir a buscar el botón).
  useEffect(() => {
    if (autoprint && datos) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoprint, datos]);

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
            <Talon tipo="cliente" ticket={ticket} negocio={negocio} config={config} senas={senas} qr={qr} />
            <div className="comp-corte">
              <span>✂</span> — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — cortar aquí
            </div>
            <Talon tipo="taller" ticket={ticket} negocio={negocio} config={config} senas={senas} qr={qr} />
          </>
        ) : (
          <Talon tipo="cliente" ticket={ticket} negocio={negocio} config={config} senas={senas} qr={qr} />
        )}
      </div>
    </main>
  );
}
