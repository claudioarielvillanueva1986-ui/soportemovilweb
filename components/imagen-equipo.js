'use client';

import { useEffect, useState } from 'react';

// Mismo criterio que v1: probar imágenes reales de GSMArena directo desde
// el navegador (sin backend, sin scraping) y quedarse con la primera que
// cargue. Si ninguna carga, se usa el fallback (ícono o iniciales) — nunca rompe.
function slugGsmarena(marca, modelo) {
  return (marca + ' ' + modelo)
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function candidatosImagen(marca, modelo) {
  const slug = slugGsmarena(marca, modelo);
  const mL = (marca || '').toLowerCase();
  const moUnder = (modelo || '').toLowerCase().replace(/\s+/g, '_');
  return [`https://fdn2.gsmarena.com/vv/bigpic/${slug}.jpg`, `https://fdn2.gsmarena.com/vv/bigpic/${mL}_${moUnder}.jpg`];
}

function leerCache() {
  try {
    return JSON.parse(sessionStorage.getItem('phone_img_cache') || '{}');
  } catch {
    return {};
  }
}
function guardarCache(cache) {
  try {
    sessionStorage.setItem('phone_img_cache', JSON.stringify(cache));
  } catch {
    // sessionStorage puede no estar disponible (modo privado) — no es crítico
  }
}

export function useImagenEquipo(marca, modelo) {
  const [url, setUrl] = useState(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const mo = (modelo || '').trim();
    const ma = (marca || '').trim();
    if (mo.length < 3) {
      setUrl(null);
      setBuscando(false);
      return;
    }

    const key = (ma + '_' + mo).toLowerCase();
    const cache = leerCache();
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      setUrl(cache[key]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    (async () => {
      let encontrada = null;
      for (const candidata of candidatosImagen(ma, mo)) {
        const ok = await new Promise((res) => {
          const t = new Image();
          t.onload = () => res(true);
          t.onerror = () => res(false);
          t.src = candidata;
        });
        if (ok) {
          encontrada = candidata;
          break;
        }
      }
      if (cancelado) return;
      const nuevaCache = { ...leerCache(), [key]: encontrada };
      guardarCache(nuevaCache);
      setUrl(encontrada);
      setBuscando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [marca, modelo]);

  return { url, buscando, limpiar: () => setUrl(null) };
}

// Caja autocontenida (ícono genérico si no hay foto) — para formularios de
// alta/edición donde no hay un avatar de color propio de la orden.
export function ImagenEquipo({ marca, modelo, size = 64 }) {
  const { url, buscando, limpiar } = useImagenEquipo(marca, modelo);

  return (
    <div className="img-equipo-wrap" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="" className="img-equipo-foto" onError={limpiar} />
      ) : (
        <span className="img-equipo-icon" style={{ fontSize: size * 0.4 }}>
          {buscando ? '⏳' : '📱'}
        </span>
      )}
    </div>
  );
}
