'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, METODOS_PAGO, formatMoney, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

export default function ImprimirVentaPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: v, error: e1 }, { data: neg }, { data: cfg }] = await Promise.all([
        supabase
          .from('ventas')
          .select('*, clientes(nombre), venta_items(descripcion, cantidad, precio_unitario, subtotal, productos(nombre)), venta_pagos(metodo, monto)')
          .eq('id', id)
          .maybeSingle(),
        supabase.from('negocios').select('*').maybeSingle(),
        supabase.from('comprobante_config').select('*').maybeSingle(),
      ]);
      if (e1 || !v) {
        setError('No se encontró la venta.');
        return;
      }
      setDatos({ venta: v, negocio: neg, config: cfg || {} });
    })();
  }, [id]);

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!datos) return <PantallaCarga />;

  const { venta, negocio, config } = datos;
  const lineas = (config?.encabezado || '').split('\n').filter(Boolean);
  const items = venta.venta_items || [];
  const pagos = venta.venta_pagos || [];

  return (
    <main>
      <div className="no-imprimir" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <button className="btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <a className="btn btn-secondary btn-sm" href="/panel/ventas">Volver a ventas</a>
      </div>

      <div className="comprobante comp-a4">
        <div className="comp-talon">
          <div className="comp-head">
            <div>
              <div className="comp-negocio">{negocio?.nombre}</div>
              {lineas.map((l, i) => (
                <div className="comp-sub" key={i}>{l}</div>
              ))}
            </div>
            <div className="comp-derecha">
              <div className="comp-tipo">COMPROBANTE DE VENTA</div>
              <div className="comp-numero">#{venta.numero}</div>
              <div className="comp-sub">{formatFecha(venta.created_at)}</div>
              {venta.anulada && (
                <div className="comp-sub" style={{ color: '#ef4444', fontWeight: 700 }}>ANULADA</div>
              )}
            </div>
          </div>

          <div className="comp-grid">
            <div>
              <span className="comp-lbl">Cliente</span>
              {venta.clientes?.nombre || 'Consumidor final'}
            </div>
            <div>
              <span className="comp-lbl">Pago</span>
              {METODOS_PAGO[venta.metodo_pago] || venta.metodo_pago}
            </div>
          </div>

          <table className="tabla" style={{ margin: '14px 0' }}>
            <thead>
              <tr>
                <th>Detalle</th>
                <th style={{ textAlign: 'center' }}>Cant.</th>
                <th style={{ textAlign: 'right' }}>Unitario</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, ix) => (
                <tr key={ix}>
                  <td>{i.descripcion || i.productos?.nombre || 'Ítem'}</td>
                  <td style={{ textAlign: 'center' }}>{i.cantidad}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(i.precio_unitario)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="comp-grid">
            {Number(venta.descuento) > 0 && (
              <>
                <div><span className="comp-lbl">Subtotal</span>{formatMoney(venta.subtotal)}</div>
                <div><span className="comp-lbl">Descuento</span>{venta.descuento}%</div>
              </>
            )}
            <div>
              <span className="comp-lbl">Total</span>
              <strong style={{ fontSize: '1.1rem' }}>{formatMoney(venta.total)}</strong>
            </div>
            {pagos.length > 1 &&
              pagos.map((p, ix) => (
                <div key={ix}>
                  <span className="comp-lbl">{METODOS_PAGO[p.metodo] || p.metodo}</span>
                  {formatMoney(p.monto)}
                </div>
              ))}
          </div>

          {venta.facturada_en && (
            <div className="comp-seguimiento">
              Factura electrónica · CAE <strong>{venta.factura_cae}</strong>
            </div>
          )}
          {config?.pie && <div className="comp-pie">{config.pie}</div>}
        </div>
      </div>
    </main>
  );
}
