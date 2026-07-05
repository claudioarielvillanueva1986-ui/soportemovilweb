'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { supabase, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

// Etiqueta chica para pegar en el equipo físico, con QR de seguimiento.
export default function EtiquetaPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: neg }] = await Promise.all([
        supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
        supabase.from('negocios').select('nombre').maybeSingle(),
      ]);
      if (!t) {
        setError('No se encontró la orden.');
        return;
      }
      setDatos({ ticket: t, negocio: neg });
    })();
  }, [id]);

  useEffect(() => {
    if (datos && canvasRef.current) {
      const url = `${window.location.origin}/consulta`;
      QRCode.toCanvas(canvasRef.current, `${url}?orden=${datos.ticket.numero}`, {
        width: 84,
        margin: 0,
      });
    }
  }, [datos]);

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!datos) return <PantallaCarga />;

  const { ticket, negocio } = datos;

  return (
    <main>
      <div className="no-imprimir" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => window.print()}>
          Imprimir etiqueta
        </button>
        <a className="btn btn-secondary btn-sm" href="/panel/tickets">
          Volver a órdenes
        </a>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          Pegala en el equipo o en su bolsa.
        </span>
      </div>

      <div className="comprobante etiqueta">
        <div className="etiqueta-izq">
          <div className="etiqueta-negocio">{negocio?.nombre}</div>
          <div className="etiqueta-numero">{ticket.numero}</div>
          <div className="etiqueta-dato">{ticket.nombre}</div>
          <div className="etiqueta-dato">
            {ticket.marca_modelo || ticket.dispositivo}
          </div>
          <div className="etiqueta-dato" style={{ color: '#666' }}>
            {formatFecha(ticket.created_at)}
          </div>
        </div>
        <canvas ref={canvasRef} />
      </div>
    </main>
  );
}
