'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';

// ═══════════════════════════════════════════════════════════════════════
// Migración dedicada desde Soporte Móvil v1 — conoce el schema real de v1
// (fijo, no elegido por el usuario) así que no hace falta mapear columnas:
// subís el .db y listo. Clientes, órdenes y ventas (incluye señas/saldos
// de reparación, que en v1 viven mezcladas en la tabla "ventas" con
// referencia = "Orden {id}").
// ═══════════════════════════════════════════════════════════════════════

const ESTADO_V1_A_V2 = {
  recibido: 'recibido',
  'en proceso': 'en_proceso',
  reparado: 'reparado',
  entregado: 'entregado',
  'entregado (s/r)': 'entregado_sr',
  'no reparado': 'no_reparado',
  cancelado: 'cancelado',
};

function mapEstado(v1Estado) {
  const k = String(v1Estado || '').trim().toLowerCase();
  return ESTADO_V1_A_V2[k] || 'entregado';
}

function mapMetodo(v1Medio) {
  const m = String(v1Medio || '').toLowerCase();
  if (m.includes('qr')) return 'mercadopago_qr';
  if (m.includes('mp') || m.includes('mercado pago') || m.includes('point')) return 'mercadopago_point';
  if (m.includes('transfer')) return 'transferencia';
  if (m.includes('tarjeta') || m.includes('credito') || m.includes('crédito') || m.includes('debito') || m.includes('débito')) return 'tarjeta';
  return 'efectivo';
}

function mapMetodoVenta(v1Medio) {
  const m = String(v1Medio || '').toLowerCase();
  if (m.includes('qr')) return 'mercadopago_qr';
  if (m.includes('mp') || m.includes('mercado pago') || m.includes('point')) return 'mercadopago_point';
  if (m.includes('transfer')) return 'transferencia';
  if (m.includes('débito') || m.includes('debito')) return 'debito';
  if (m.includes('crédito') || m.includes('credito')) return 'credito';
  if (m.includes('tarjeta')) return 'tarjeta';
  return 'efectivo';
}

function aArray(texto) {
  const s = String(texto || '').trim();
  if (!s) return null;
  return s
    .split(/[,;]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function aFechaISO(v1Fecha) {
  if (!v1Fecha) return new Date().toISOString();
  const s = String(v1Fecha).trim().replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const RE_ORDEN_REF = /orden\s+(\d+)/i;

function leerTablaSQLite(db, nombre) {
  try {
    const res = db.exec(`select * from "${nombre}"`);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((fila) => Object.fromEntries(cols.map((c, i) => [c, fila[i]])));
  } catch {
    return null; // la tabla no existe en este archivo
  }
}

async function insertarEnLotes(tabla, registros, seleccion) {
  const insertados = [];
  for (let i = 0; i < registros.length; i += 200) {
    const lote = registros.slice(i, i + 200);
    const { data, error } = await supabase.from(tabla).insert(lote).select(seleccion || '*');
    if (error) throw new Error(`${tabla}: ${error.message}`);
    insertados.push(...(data || []));
  }
  return insertados;
}

function MigracionV1() {
  const [dbRef, setDbRef] = useState(null);
  const [datos, setDatos] = useState(null); // {clientes, ordenes, ventas} | null
  const [existentes, setExistentes] = useState(null);
  const [estado, setEstado] = useState(null);
  const [migrando, setMigrando] = useState(false);
  const [paso, setPaso] = useState('');
  const [resumen, setResumen] = useState(null);

  useEffect(() => () => dbRef?.close?.(), [dbRef]);

  async function abrirArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setEstado(null);
    setDatos(null);
    setResumen(null);
    try {
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
      const buf = new Uint8Array(await archivo.arrayBuffer());
      const db = new SQL.Database(buf);
      setDbRef(db);

      const clientes = leerTablaSQLite(db, 'clientes');
      const ordenes = leerTablaSQLite(db, 'ordenes');
      const ventas = leerTablaSQLite(db, 'ventas');

      if (clientes == null && ordenes == null && ventas == null) {
        setEstado({
          tipo: 'error',
          texto: 'No encontramos las tablas de Soporte Móvil v1 (clientes / ordenes / ventas) en este archivo. ¿Es la base correcta?',
        });
        return;
      }

      const [{ data: cliV1 }, { data: tickV1 }, { data: ventV1 }] = await Promise.all([
        supabase.from('clientes').select('v1_id').not('v1_id', 'is', null),
        supabase.from('tickets').select('v1_id').not('v1_id', 'is', null),
        supabase.from('ventas').select('v1_id').not('v1_id', 'is', null),
      ]);
      setExistentes({
        clientes: new Set((cliV1 || []).map((r) => r.v1_id)),
        tickets: new Set((tickV1 || []).map((r) => r.v1_id)),
        ventas: new Set((ventV1 || []).map((r) => r.v1_id)),
      });

      setDatos({ clientes: clientes || [], ordenes: ordenes || [], ventas: ventas || [] });
    } catch (err) {
      setEstado({ tipo: 'error', texto: `No se pudo leer el archivo: ${err.message}` });
    }
  }

  async function migrarTodo() {
    setMigrando(true);
    setEstado(null);
    setResumen(null);
    const totales = {
      clientes: 0, clientesOmitidos: 0,
      ordenes: 0, ordenesOmitidas: 0,
      pagosOrden: 0,
      ventas: 0, ventasOmitidas: 0, ventasSinReferencia: 0,
    };
    try {
      const { data: neg } = await supabase.from('negocios').select('id').maybeSingle();
      if (!neg) throw new Error('No se pudo identificar tu negocio. Recargá e intentá de nuevo.');

      // 1) Clientes
      setPaso('Migrando clientes...');
      const clientesNuevos = (datos.clientes || []).filter((c) => !existentes.clientes.has(c.id));
      totales.clientesOmitidos = (datos.clientes || []).length - clientesNuevos.length;
      const mapaClientes = new Map(); // v1 id -> v2 uuid
      if (clientesNuevos.length) {
        const registros = clientesNuevos.map((c) => ({
          negocio_id: neg.id,
          v1_id: c.id,
          nombre: c.nombre || `Cliente v1 #${c.id}`,
          telefono: c.telefono || null,
          email: c.email ? String(c.email).toLowerCase() : null,
          dni: c.dni || null,
          notas: c.direccion ? `Dirección (de v1): ${c.direccion}` : null,
        }));
        const insertados = await insertarEnLotes('clientes', registros, 'id, v1_id');
        totales.clientes = insertados.length;
        insertados.forEach((r) => mapaClientes.set(r.v1_id, r.id));
      }
      // clientes ya importados en una corrida anterior también deben quedar mapeados
      if (existentes.clientes.size) {
        const { data: previos } = await supabase.from('clientes').select('id, v1_id').not('v1_id', 'is', null);
        (previos || []).forEach((r) => mapaClientes.set(r.v1_id, r.id));
      }

      // 2) Órdenes
      setPaso('Migrando órdenes...');
      const ordenesNuevas = (datos.ordenes || []).filter((o) => !existentes.tickets.has(o.id));
      totales.ordenesOmitidas = (datos.ordenes || []).length - ordenesNuevas.length;
      const mapaOrdenes = new Map(); // v1 id -> v2 uuid
      if (ordenesNuevas.length) {
        const registros = ordenesNuevas.map((o) => ({
          negocio_id: neg.id,
          v1_id: o.id,
          numero: `V1-${o.id}`,
          nombre: o.cliente_nombre || 'Cliente v1',
          telefono: o.cliente_telefono || null,
          cliente_id: o.cliente_id != null ? mapaClientes.get(o.cliente_id) || null : null,
          dispositivo: 'Celular',
          marca_modelo: [o.equipo_marca, o.equipo_modelo].filter(Boolean).join(' ') || null,
          imei_serial: o.imei_serial || null,
          color: o.color || null,
          condicion_fisica: o.condicion_fisica || null,
          accesorios: aArray(o.accesorios),
          tipo_reparacion: aArray(o.tipo_reparacion),
          descripcion: o.problema || null,
          equipo_password: o.contrasena_patron || null,
          estado: mapEstado(o.estado),
          presupuesto: o.monto_total != null ? Number(o.monto_total) : null,
          created_at: aFechaISO(o.fecha_entrada),
        }));
        const insertados = await insertarEnLotes('tickets', registros, 'id, v1_id');
        totales.ordenes = insertados.length;
        insertados.forEach((r) => mapaOrdenes.set(r.v1_id, r.id));
      }
      if (existentes.tickets.size) {
        const { data: previos } = await supabase.from('tickets').select('id, v1_id').not('v1_id', 'is', null);
        (previos || []).forEach((r) => mapaOrdenes.set(r.v1_id, r.id));
      }

      // 3) Ventas de v1: separar cobros de orden (referencia "Orden N") del
      // resto (ventas de mostrador genéricas)
      const todasVentas = datos.ventas || [];
      const cobrosOrden = [];
      const ventasMostrador = [];
      for (const v of todasVentas) {
        const m = String(v.referencia || '').match(RE_ORDEN_REF);
        if (m) cobrosOrden.push({ ...v, _ordenV1Id: Number(m[1]) });
        else ventasMostrador.push(v);
      }

      // 3a) Cobros de orden → ticket_pagos
      setPaso('Migrando pagos de órdenes...');
      const { data: pagosExistentes } = await supabase
        .from('ticket_pagos')
        .select('v1_venta_id')
        .not('v1_venta_id', 'is', null);
      const idsPagosExistentes = new Set((pagosExistentes || []).map((r) => r.v1_venta_id));
      const ordenesConPago = new Set();
      const registrosPagos = [];
      for (const c of cobrosOrden) {
        if (idsPagosExistentes.has(c.id)) continue;
        const ticketId = mapaOrdenes.get(c._ordenV1Id);
        if (!ticketId) continue; // la orden no se importó (no estaba en este archivo)
        const monto = Number(c.monto);
        if (!monto) continue;
        ordenesConPago.add(c._ordenV1Id);
        if (monto > 0) {
          registrosPagos.push({
            ticket_id: ticketId,
            tipo: 'pago',
            metodo: mapMetodo(c.medio_pago),
            monto,
            created_at: aFechaISO(c.fecha),
            v1_venta_id: c.id,
          });
        } else {
          registrosPagos.push({
            ticket_id: ticketId,
            tipo: 'devolucion',
            metodo: mapMetodo(c.medio_pago),
            monto,
            created_at: aFechaISO(c.fecha),
            v1_venta_id: c.id,
          });
        }
      }
      // Fallback: órdenes con seña > 0 en v1 pero sin ninguna fila de pago
      // detectada (huecos de datos viejos) — se registra la seña una vez.
      for (const o of ordenesNuevas) {
        const senia = Number(o['seña'] ?? o.sena ?? 0);
        if (senia > 0 && !ordenesConPago.has(o.id)) {
          const ticketId = mapaOrdenes.get(o.id);
          if (ticketId) {
            registrosPagos.push({
              ticket_id: ticketId,
              tipo: 'sena',
              metodo: 'efectivo',
              monto: senia,
              created_at: aFechaISO(o.fecha_entrada),
              v1_venta_id: null,
            });
          }
        }
      }
      if (registrosPagos.length) {
        const insertados = await insertarEnLotes('ticket_pagos', registrosPagos, 'id');
        totales.pagosOrden = insertados.length;
      }

      // 3b) Resto de ventas → ventas de mostrador (vía RPC, ventas/venta_items
      // no admiten insert directo por la lógica de stock)
      setPaso('Migrando ventas de mostrador...');
      const ventasNuevas = ventasMostrador.filter((v) => !existentes.ventas.has(v.id));
      totales.ventasOmitidas = ventasMostrador.length - ventasNuevas.length;
      // Ventas negativas sin referencia a una orden: no hay forma confiable
      // de saber a qué venta original corresponden — se listan y se omiten
      // en vez de inventar un ajuste.
      const ventasValidas = ventasNuevas.filter((v) => Number(v.monto) > 0);
      totales.ventasSinReferencia = ventasNuevas.length - ventasValidas.length;
      if (ventasValidas.length) {
        const filas = ventasValidas.map((v) => ({
          v1_id: v.id,
          total: Number(v.monto),
          metodo_pago: mapMetodoVenta(v.medio_pago),
          descripcion: v.producto || 'Importado de v1',
          created_at: aFechaISO(v.fecha),
          anulada: false,
        }));
        for (let i = 0; i < filas.length; i += 300) {
          const lote = filas.slice(i, i + 300);
          const { data, error } = await supabase.rpc('importar_ventas_v1', { p_filas: lote });
          if (error) throw new Error(`ventas: ${error.message}`);
          totales.ventas += data?.insertados || 0;
        }
      }

      setResumen(totales);
      setEstado({ tipo: 'ok', texto: '¡Migración terminada! Revisá el resumen abajo.' });
    } catch (err) {
      setEstado({ tipo: 'error', texto: err.message });
    } finally {
      setMigrando(false);
      setPaso('');
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24, borderColor: 'var(--accent)' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        📦 Migrar desde Soporte Móvil v1
        <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Recomendado</span>
      </h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 16, maxWidth: 640 }}>
        Subí el archivo <strong>.db</strong> que descargaste de tu Soporte Móvil v1 y migramos
        clientes, órdenes (con su estado e historial) y ventas — incluyendo los cobros de
        reparación, que quedan asociados a la orden correspondiente en la caja. No hace falta
        mapear columnas: ya conocemos la estructura. Podés volver a subir el mismo archivo sin
        miedo a duplicar — lo ya importado se detecta y se salta.
      </p>

      {estado && (
        <div className={`alert ${estado.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`} style={{ marginBottom: 14 }}>
          {estado.texto}
        </div>
      )}

      {!datos && (
        <div className="field" style={{ maxWidth: 420 }}>
          <label>Archivo .db / .sqlite de v1</label>
          <input type="file" accept=".db,.sqlite,.sqlite3" onChange={abrirArchivo} />
        </div>
      )}

      {datos && !resumen && (
        <>
          <div className="detalle-grid" style={{ marginBottom: 16 }}>
            <div>
              <dt>Clientes</dt>
              <dd>
                {datos.clientes.length} en el archivo
                {existentes && ` · ${datos.clientes.filter((c) => existentes.clientes.has(c.id)).length} ya importados`}
              </dd>
            </div>
            <div>
              <dt>Órdenes</dt>
              <dd>
                {datos.ordenes.length} en el archivo
                {existentes && ` · ${datos.ordenes.filter((o) => existentes.tickets.has(o.id)).length} ya importadas`}
              </dd>
            </div>
            <div>
              <dt>Ventas / cobros</dt>
              <dd>{datos.ventas.length} filas en el archivo (incluye cobros de orden y mostrador)</dd>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn" onClick={migrarTodo} disabled={migrando}>
              {migrando ? <span className="spinner" /> : 'Migrar todo'}
            </button>
            {migrando && <span className="lbl2">{paso}</span>}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={migrando}
              onClick={() => {
                setDatos(null);
                setEstado(null);
              }}
            >
              Elegir otro archivo
            </button>
          </div>
        </>
      )}

      {resumen && (
        <div className="detalle-grid">
          <div><dt>Clientes importados</dt><dd style={{ color: 'var(--ok)' }}>{resumen.clientes}</dd></div>
          <div><dt>Clientes ya existentes (omitidos)</dt><dd>{resumen.clientesOmitidos}</dd></div>
          <div><dt>Órdenes importadas</dt><dd style={{ color: 'var(--ok)' }}>{resumen.ordenes}</dd></div>
          <div><dt>Órdenes ya existentes (omitidas)</dt><dd>{resumen.ordenesOmitidas}</dd></div>
          <div><dt>Pagos de órdenes migrados</dt><dd style={{ color: 'var(--ok)' }}>{resumen.pagosOrden}</dd></div>
          <div><dt>Ventas de mostrador importadas</dt><dd style={{ color: 'var(--ok)' }}>{resumen.ventas}</dd></div>
          <div><dt>Ventas ya existentes (omitidas)</dt><dd>{resumen.ventasOmitidas}</dd></div>
          {resumen.ventasSinReferencia > 0 && (
            <div>
              <dt>Ventas negativas sin orden asociada (no importadas)</dt>
              <dd style={{ color: 'var(--warn)' }}>{resumen.ventasSinReferencia}</dd>
            </div>
          )}
          <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setDatos(null);
                setResumen(null);
                setEstado(null);
              }}
            >
              Migrar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Importador genérico self-service: trae clientes y productos desde un .db
// (SQLite) de otro sistema o desde un CSV, con mapeo de columnas y vista
// previa. Para migrar desde Soporte Móvil v1 específicamente, usá la
// herramienta de arriba (conoce el schema real, no hace falta mapear).

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

    const { data: neg, error: errNeg } = await supabase
      .from('negocios')
      .select('id')
      .maybeSingle();
    if (errNeg || !neg) {
      setImportando(false);
      setEstado({ tipo: 'error', texto: 'No se pudo identificar tu negocio. Recargá e intentá de nuevo.' });
      return;
    }
    const limpiar = (v) => {
      const s = v == null ? '' : String(v).trim();
      return s === '' || s === 'None' || s === 'null' ? null : s;
    };
    // Maneja formato argentino "1.234,56" y también "1234.56"
    const num = (v) => {
      let s = String(v ?? '').trim().replace(/[^0-9.,-]/g, '');
      if (s.includes(',')) {
        // coma = decimal → los puntos son miles
        s = s.replace(/\./g, '').replace(',', '.');
      } else if ((s.match(/\./g) || []).length > 1) {
        // varios puntos y sin coma → puntos de miles
        s = s.replace(/\./g, '');
      }
      const n = parseFloat(s);
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
        <h1 className="panel-h1">Importar datos</h1>
        <p style={{ color: 'var(--text-dim)' }}>Solo el dueño puede importar datos.</p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="panel-h1">Importar datos</h1>

      <MigracionV1 />

      <h2 style={{ marginBottom: 4 }}>Importador genérico</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 18, maxWidth: 640 }}>
        Para clientes o inventario desde otro sistema (no Soporte Móvil v1): subí la base{' '}
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
