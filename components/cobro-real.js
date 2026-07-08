'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase, formatMoney } from '@/lib/supabase';

export const METODOS_ELECTRONICOS_ORDEN = ['tarjeta', 'mercadopago_qr', 'mercadopago_point'];

// El QR y los links de cobro nunca deben apuntar directo a mercadopago.com:
// la app de Mercado Pago instalada reclama ese dominio y, si el cliente
// escanea con SU lector de QR (no con la cámara), interpreta el link de
// Checkout Pro como un código inválido y muestra "QR inválido". Pasar
// primero por nuestro propio dominio evita que la app lo intercepte.
export function armarLinkPago(initPoint) {
  if (typeof window === 'undefined') return initPoint;
  return `${window.location.origin}/pagar?ir=${encodeURIComponent(initPoint)}`;
}

// Cobro real por Mercado Pago (vía Facturá): genera un link/QR de Checkout
// Pro y sondea el estado hasta que se aprueba o se rechaza. Compartido por
// el POS y por los pagos de órdenes (seña, saldo).
export function useCobroReal() {
  const [cobro, setCobro] = useState(null); // { onAprobado, cobroId, qrImg, initPoint, estado, error, monto, mpPaymentId }
  const pollingRef = useRef(null);

  function detenerPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function iniciarCobro(monto, descripcion, onAprobado) {
    if (!monto || monto <= 0) return;
    setCobro({ onAprobado, cobroId: null, qrImg: null, initPoint: null, estado: 'creando', error: null, monto, mpPaymentId: null });
    const { data: sesion } = await supabase.auth.getSession();
    const token = sesion?.session?.access_token || '';
    try {
      const res = await fetch('/api/facturacion/cobro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ monto, descripcion }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobro((c) => (c ? { ...c, estado: 'error', error: data.error || 'No se pudo generar el cobro' } : c));
        return;
      }
      const linkPago = armarLinkPago(data.init_point);
      const qrImg = await QRCode.toDataURL(linkPago, { width: 220, margin: 1 }).catch(() => null);
      setCobro((c) => (c ? { ...c, cobroId: data.cobro_id, initPoint: linkPago, qrImg, estado: 'pendiente' } : c));
      pollingRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/facturacion/cobro/estado?cobro_id=${data.cobro_id}&token=${encodeURIComponent(token)}`);
          const d = await r.json();
          if (d.estado === 'aprobado') {
            detenerPolling();
            setCobro((c) => (c ? { ...c, estado: 'aprobado', mpPaymentId: d.mp_payment_id } : c));
          } else if (d.estado === 'rechazado') {
            detenerPolling();
            setCobro((c) => (c ? { ...c, estado: 'error', error: 'El pago fue rechazado.' } : c));
          }
        } catch {
          /* reintenta en el próximo tick */
        }
      }, 2500);
    } catch (e) {
      setCobro((c) => (c ? { ...c, estado: 'error', error: 'Error de conexión: ' + e.message } : c));
    }
  }

  function cancelarCobro() {
    detenerPolling();
    setCobro(null);
  }

  function continuarTrasCobro() {
    detenerPolling();
    cobro?.onAprobado?.(cobro.mpPaymentId, cobro.monto);
    setCobro(null);
  }

  useEffect(() => () => detenerPolling(), []);

  return { cobro, iniciarCobro, cancelarCobro, continuarTrasCobro };
}

export function ModalCobroReal({ cobro, cancelarCobro, continuarTrasCobro }) {
  if (!cobro) return null;
  return (
    <div className="mp-cobro-overlay" onClick={cobro.estado === 'aprobado' ? undefined : cancelarCobro}>
      <div className="mp-cobro-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mp-cobro-head">
          <span>📲 Cobro con Mercado Pago</span>
          {cobro.estado !== 'aprobado' && (
            <button className="mp-cobro-x" onClick={cancelarCobro} aria-label="Cerrar">×</button>
          )}
        </div>
        <div className="mp-cobro-monto">{formatMoney(cobro.monto)}</div>

        {cobro.estado === 'creando' && (
          <div className="mp-cobro-estado">
            <span className="spinner" />
            <p>Generando el link de pago...</p>
          </div>
        )}

        {cobro.estado === 'pendiente' && (
          <>
            {cobro.qrImg && <img className="mp-cobro-qr" src={cobro.qrImg} alt="QR de pago" />}
            <div className="mp-cobro-info">
              <div className="tit">¿Cómo cobra?</div>
              <p>📱 El cliente escanea el QR con la cámara del celular (no con el lector de la app de Mercado Pago)</p>
              <p>🔗 O abrí el link y enviáselo por WhatsApp</p>
            </div>
            <a
              className="mp-cobro-wa"
              href={`https://wa.me/?text=${encodeURIComponent('Pagá acá: ' + cobro.initPoint)}`}
              target="_blank"
              rel="noreferrer"
            >
              📱 Enviar link por WhatsApp
            </a>
            <button type="button" className="mp-cobro-copiar" onClick={() => navigator.clipboard?.writeText(cobro.initPoint)}>
              🔗 Copiar link de pago
            </button>
            <div className="mp-cobro-esperando">Esperando confirmación del pago…</div>
          </>
        )}

        {cobro.estado === 'aprobado' && (
          <div className="mp-cobro-estado ok">
            <div className="ico">✅</div>
            <p>Pago aprobado</p>
            <button className="btn" style={{ marginTop: 14 }} onClick={continuarTrasCobro}>
              Continuar
            </button>
          </div>
        )}

        {cobro.estado === 'error' && (
          <div className="mp-cobro-estado error">
            <p>{cobro.error}</p>
            <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={cancelarCobro}>
              Cerrar
            </button>
          </div>
        )}

        {cobro.estado !== 'aprobado' && cobro.estado !== 'error' && (
          <button type="button" className="mp-cobro-cancelar" onClick={cancelarCobro}>
            ✕ Cancelar pago
          </button>
        )}
      </div>
    </div>
  );
}
