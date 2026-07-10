'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, ESTADOS, formatMoney, formatFecha, METODOS_PAGO } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

function sumarDias(iso, dias) {
  const d = new Date(iso);
  d.setDate(d.getDate() + dias);
  return d;
}

export default function ComprobanteGarantiaPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: t, error: e1 }, { data: neg }, { data: cfg }, { data: pagos }] = await Promise.all([
        supabase.from('tickets').select('*, clientes(dni)').eq('id', id).maybeSingle(),
        supabase.from('negocios').select('*').maybeSingle(),
        supabase.from('comprobante_config').select('*').maybeSingle(),
        supabase.from('ticket_pagos').select('*').eq('ticket_id', id).order('created_at'),
      ]);
      if (e1 || !t) {
        setError('No se encontró la orden.');
        return;
      }
      setDatos({ ticket: t, negocio: neg, garantiaDias: cfg?.garantia_dias ?? 30, pagos: pagos || [] });
    })();
  }, [id]);

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!datos) return <PantallaCarga />;

  const { ticket, negocio, garantiaDias, pagos } = datos;
  const fechaEntrega = ticket.entregado_at || ticket.updated_at || ticket.created_at;
  const fechaVence = sumarDias(fechaEntrega, garantiaDias);
  const totalCobrado = pagos.filter((p) => Number(p.monto) > 0).reduce((s, p) => s + Number(p.monto), 0);

  return (
    <main>
      <div className="no-imprimir" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <button className="btn" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
        <a className="btn btn-secondary btn-sm" href={`/panel/tickets/${id}`}>
          ← Volver a la orden
        </a>
      </div>

      <div className="comprobante comp-a4 comp-garantia">
        <div className="comp-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="comp-logo">
              {(negocio?.nombre || '?').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div className="comp-negocio">{negocio?.nombre}</div>
              <div className="comp-sub">{negocio?.direccion}</div>
            </div>
          </div>
          <div className="comp-derecha">
            <div className="comp-tipo">COMPROBANTE DE ENTREGA</div>
            <div className="comp-numero">{ticket.numero}</div>
            <div className="comp-sub">{formatFecha(fechaEntrega)}</div>
          </div>
        </div>

        <div className="garantia-title-band">
          <span>✅ El equipo fue reparado y entregado satisfactoriamente</span>
        </div>

        <div className="comp-grid" style={{ marginTop: 14 }}>
          <div>
            <span className="comp-lbl">Cliente</span>
            {ticket.nombre}
          </div>
          <div>
            <span className="comp-lbl">Teléfono</span>
            {ticket.telefono || '—'}
          </div>
          <div>
            <span className="comp-lbl">DNI</span>
            {ticket.clientes?.dni || '—'}
          </div>
          <div>
            <span className="comp-lbl">Equipo</span>
            {ticket.dispositivo}
            {ticket.marca_modelo ? ` — ${ticket.marca_modelo}` : ''}
            {ticket.color ? ` (${ticket.color})` : ''}
          </div>
          {ticket.imei_serial && (
            <div>
              <span className="comp-lbl">IMEI / Serial</span>
              {ticket.imei_serial}
            </div>
          )}
          <div>
            <span className="comp-lbl">Estado</span>
            {ESTADOS[ticket.estado]?.label || ticket.estado}
          </div>
        </div>

        <div className="comp-falla" style={{ marginTop: 12 }}>
          <span className="comp-lbl">Trabajo realizado</span>
          {ticket.descripcion}
          {ticket.tipo_reparacion?.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ticket.tipo_reparacion.map((t) => (
                <span key={t} className="badge" style={{ background: '#e0f3fb', color: '#0369a1', border: '1px solid #7dd3fc' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="garantia-box">
          <div className="garantia-icon">🛡️</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div className="garantia-dias">{garantiaDias}</div>
              <div>
                <div className="garantia-lbl">días de garantía</div>
                <div style={{ fontSize: '0.7rem' }}>sobre el trabajo realizado</div>
              </div>
            </div>
            <p className="garantia-texto">
              La garantía cubre exclusivamente el trabajo de reparación realizado. No incluye daños posteriores por golpes, líquidos o mal uso.
            </p>
            <div className="garantia-vence">
              📅 Válida hasta el: <strong>{fechaVence.toLocaleDateString('es-AR')}</strong>
            </div>
          </div>
        </div>

        {totalCobrado > 0 && (
          <div style={{ marginTop: 12 }}>
            <span className="comp-lbl">Detalle de pagos</span>
            {pagos.filter((p) => Number(p.monto) > 0).map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', padding: '4px 0', borderBottom: '1px solid #e3f0f8' }}>
                <span>{METODOS_PAGO[p.metodo] || p.metodo} — {formatFecha(p.created_at)}</span>
                <strong style={{ color: '#059669' }}>+{formatMoney(p.monto)}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '2px solid #1a3550', fontWeight: 800 }}>
              <span>TOTAL COBRADO</span>
              <span>{formatMoney(totalCobrado)}</span>
            </div>
          </div>
        )}

        <div className="garantia-terminos">
          <strong>Términos de garantía:</strong>
          <br />• Cubre únicamente el trabajo específico realizado.
          <br />• No cubre daños por golpes, caídas, líquidos o mal uso posterior.
          <br />• No cubre fallas preexistentes no relacionadas con la reparación.
          <br />• Para hacer válida la garantía, presentar este comprobante.
          <br />• Equipos no retirados en 60 días quedan a disposición del taller.
        </div>

        <div className="comp-firmas">
          <div>
            <div className="comp-firma-linea" />
            Firma del cliente — Recibí conforme
          </div>
          <div>
            <div className="comp-firma-linea" />
            Firma del técnico
          </div>
        </div>
      </div>
    </main>
  );
}
