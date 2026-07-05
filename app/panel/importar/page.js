'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';

// Importador self-service: trae clientes y productos desde un .db (SQLite)
// de otro sistema o desde un CSV, con mapeo de columnas y vista previa.

const DESTINOS = {
  clientes: {
    label: 'Clientes',
    campos: [
      ['nombre', 'Nombre *'],
      ['telefono', 'Teléfono'],
      ['email', 'Email'],
      ['notas', 'Notas'],
    ],
  },
  productos: {
    label: 'Productos / inventario',
    campos: [
      ['nombre', 'Nombre *'],
      ['precio', 'Precio de venta'],
      ['costo', 'Costo'],
      ['stock', 'Stock'],
      ['sku', 'SKU / código de barras'],
    ],
  },
};

function parseCSV(texto) {
  const sep = (texto.match(/;/g) || []).length > (texto.match(/,/g) || []).length ? ';' : ',';
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  const parse = (l) => {
    const celdas = [];
    let actual = '';
    let dentro = false;
    for (const ch of l) {
      if (ch === '"') dentro = !dentro;
      else if (ch === sep && !dentro) {
        celdas.push(actual.trim());
        actual = '';
      } else actual += ch;
    }
    celdas.push(actual.trim());
    return celdas;
  };
  const columnas = parse(lineas[0]);
  const filas = lineas.slice(1).map(parse);
  return { columnas, filas };
}

export default function ImportarPage() {
  const { esDueno } = usePerfil();
  const [destino, setDestino] = useState('clientes');
  const [tablas, setTablas] = useState(null); // .db: [{nombre, filas}]
  const [dbRef, setDbRef] = useState(null);
  const [columnas, setColumnas] = useState(null);
  const [filas, setFilas] = useState(null);
  const [mapeo, setMapeo] = useState({});
  const [estado, setEstado] = useState(null); // {tipo, texto}
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  useEffect(() => () => dbRef?.close?.(), [dbRef]);

  async function abrirArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setEstado(null);
    setTablas(null);
    setColumnas(null);
    setFilas(null);
    setMapeo({});
    try {
      if (archivo.name.toLowerCase().endsWith('.csv') || archivo.type.includes('csv')) {
        const { columnas: cols, filas: fs } = parseCSV(await archivo.text());
        setColumnas(cols);
        setFilas(fs);
      } else {
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
        const buf = new Uint8Array(await archivo.arrayBuffer());
        const db = new SQL.Database(buf);
        setDbRef(db);
        const res = db.exec(
          "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"
        );
        const nombres = res[0]?.values.map((v) => v[0]) || [];
        setTablas(
          nombres.map((n) => {
            let filasN = 0;
            try {
              filasN = db.exec(`select count(*) from "${n}"`)[0].values[0][0];
            } catch {}
            return { nombre: n, filas: filasN };
          })
        );
      }
    } catch (err) {
      setEstado({ tipo: 'error', texto: `No se pudo leer el archivo: ${err.message}` });
    }
  }

  function elegirTabla(nombre) {
    try {
      const res = dbRef.exec(`select * from "${nombre}" limit 100000`);
      if (!res[0]) {
        setEstado({ tipo: 'error', texto: 'La tabla está vacía.' });
        return;
      }
      setColumnas(res[0].columns);
      setFilas(res[0].values);
      setMapeo({});
      setEstado(null);
    } catch (err) {
      setEstado({ tipo: 'error', texto: err.message });
    }
  }

  async function importar() {
    const campos = DESTINOS[destino].campos;
    if (mapeo.nombre == null || mapeo.nombre === '') {
      setEstado({ tipo: 'error', texto: 'Mapeá al menos la columna Nombre.' });
      return;
    }
    setImportando(true);
    setEstado(null);
    setProgreso(0);

    const { data: neg } = await supabase.from('negocios').select('id').maybeSingle();
    const limpiar = (v) => {
      const s = v == null ? '' : String(v).trim();
      return s === '' || s === 'None' || s === 'null' ? null : s;
    };
    const num = (v) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };

    const registros = [];
    const skusVistos = new Set();
    for (const fila of filas) {
      const val = (campo) => (mapeo[campo] === '' || mapeo[campo] == null ? null : fila[Number(mapeo[campo])]);
      const nombre = limpiar(val('nombre'));
      if (!nombre) continue;
      if (destino === 'clientes') {
        registros.push({
          negocio_id: neg.id,
          nombre,
          telefono: limpiar(val('telefono')),
          email: limpiar(val('email'))?.toLowerCase() || null,
          notas: limpiar(val('notas')),
        });
      } else {
        let sku = limpiar(val('sku'));
        if (sku && skusVistos.has(sku)) sku = null;
        if (sku) skusVistos.add(sku);
        registros.push({
          negocio_id: neg.id,
          nombre,
          categoria: 'accesorio',
          sku,
          precio: num(val('precio')),
          costo: num(val('costo')),
          stock: Math.max(Math.round(num(val('stock'))), 0),
          stock_minimo: 1,
          maneja_stock: true,
          activo: true,
        });
      }
    }

    if (registros.length === 0) {
      setImportando(false);
      setEstado({ tipo: 'error', texto: 'No se encontraron filas válidas (revisá el mapeo).' });
      return;
    }

    let insertados = 0;
    for (let i = 0; i < registros.length; i += 200) {
      const lote = registros.slice(i, i + 200);
      const { error } = await supabase.from(destino).insert(lote);
      if (error) {
        setImportando(false);
        setEstado({
          tipo: 'error',
          texto: `Error en la fila ~${i + 1}: ${error.message}. Se importaron ${insertados} antes del error.`,
        });
        return;
      }
      insertados += lote.length;
      setProgreso(Math.round((insertados / registros.length) * 100));
    }

    setImportando(false);
    setEstado({
      tipo: 'ok',
      texto: `¡Listo! Se importaron ${insertados} ${DESTINOS[destino].label.toLowerCase()}.`,
    });
    setColumnas(null);
    setFilas(null);
  }

  if (!esDueno) {
    return (
      <main>
        <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Importar datos</h1>
        <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede importar datos.</p>
      </main>
    );
  }

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Importar datos</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 18, maxWidth: 640 }}>
        Traé tus clientes o tu inventario desde otro sistema: subí la base{' '}
        <strong>.db (SQLite)</strong> o un <strong>.csv</strong> exportado, elegí
        la tabla, mapeá las columnas y listo. Todo se procesa en tu navegador —
        el archivo nunca se sube a ningún servidor.
      </p>

      {estado && (
        <div className={`alert ${estado.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>
          {estado.texto}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid-2">
          <div className="field">
            <label>¿Qué querés importar?</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              {Object.entries(DESTINOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Archivo (.db, .sqlite o .csv)</label>
            <input type="file" accept=".db,.sqlite,.sqlite3,.csv" onChange={abrirArchivo} />
          </div>
        </div>

        {tablas && !columnas && (
          <>
            <p style={{ color: 'var(--text-dim)', margin: '6px 0 10px' }}>
              Elegí la tabla que contiene tus {DESTINOS[destino].label.toLowerCase()}:
            </p>
            <div className="filters">
              {tablas
                .filter((t) => t.filas > 0)
                .map((t) => (
                  <button key={t.nombre} className="chip" onClick={() => elegirTabla(t.nombre)}>
                    {t.nombre} ({t.filas})
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      {columnas && (
        <div className="card">
          <h2>Mapeo de columnas — {filas.length} filas detectadas</h2>
          <div className="grid-2">
            {DESTINOS[destino].campos.map(([campo, label]) => (
              <div className="field" key={campo}>
                <label>{label}</label>
                <select
                  value={mapeo[campo] ?? ''}
                  onChange={(e) => setMapeo({ ...mapeo, [campo]: e.target.value })}
                >
                  <option value="">— No importar —</option>
                  {columnas.map((c, i) => (
                    <option key={i} value={i}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {mapeo.nombre != null && mapeo.nombre !== '' && (
            <div className="tabla-scroll" style={{ margin: '10px 0 16px' }}>
              <table className="tabla">
                <thead>
                  <tr>
                    {DESTINOS[destino].campos
                      .filter(([c]) => mapeo[c] != null && mapeo[c] !== '')
                      .map(([c, l]) => (
                        <th key={c}>{l.replace(' *', '')}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 5).map((fila, i) => (
                    <tr key={i}>
                      {DESTINOS[destino].campos
                        .filter(([c]) => mapeo[c] != null && mapeo[c] !== '')
                        .map(([c]) => (
                          <td key={c}>{String(fila[Number(mapeo[c])] ?? '')}</td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="btn" onClick={importar} disabled={importando}>
            {importando ? `Importando... ${progreso}%` : `Importar ${filas.length} filas`}
          </button>
        </div>
      )}

      <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 18, maxWidth: 640 }}>
        ¿Necesitás una migración completa con órdenes históricas, ventas y señas
        (como bases de sistemas anteriores)? Escribinos y la hacemos por vos, con
        verificación de totales incluida.
      </p>
    </main>
  );
}
