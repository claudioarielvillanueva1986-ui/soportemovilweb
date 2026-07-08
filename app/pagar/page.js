'use client';

import { useEffect, useState } from 'react';

// Puente antes de ir a Mercado Pago. Sin esto, un QR o link que apunta
// directo a mercadopago.com puede ser "atrapado" por la app de Mercado
// Pago instalada en el celular (Android/iOS registran ese dominio) y
// mostrar "QR inválido", porque su lector de QR espera un código de pago
// en persona propio, no un link de Checkout Pro. Al pasar primero por
// nuestro dominio, el teléfono abre el navegador normal y desde ahí sí
// se puede completar el pago.
const DOMINIOS_PERMITIDOS = ['mercadopago.com', 'mercadopago.com.ar', 'mercadolibre.com', 'mercadolibre.com.ar'];

function dominioPermitido(url) {
  try {
    const host = new URL(url).hostname;
    return DOMINIOS_PERMITIDOS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export default function PagarPage() {
  const [destino, setDestino] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ir = new URLSearchParams(window.location.search).get('ir');
    const url = ir ? decodeURIComponent(ir) : null;
    if (!url || !dominioPermitido(url)) {
      setError('Link de pago inválido.');
      return;
    }
    setDestino(url);
    const t = setTimeout(() => window.location.replace(url), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
      {error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <>
          <span className="spinner" style={{ width: 28, height: 28 }} />
          <p style={{ marginTop: 16, color: 'var(--text-dim)' }}>Abriendo Mercado Pago para completar el pago…</p>
          {destino && (
            <a className="btn" style={{ marginTop: 10 }} href={destino}>
              Si no se abrió, tocá acá
            </a>
          )}
        </>
      )}
    </main>
  );
}
