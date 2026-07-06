# Plan de paridad con v1 — Soporte Móvil v2

Relevamiento de las **235 rutas** del `app.py` de v1 (10.445 líneas) cruzadas contra lo que
ya existe en v2. Objetivo: reimplementar **todo** lo útil de v1, pero mejor (sin sus bugs) y
sin volver a un monolito. Regla de arquitectura para cada ítem: **1 función = pocas RPCs
`SECURITY DEFINER` scopeadas por `mi_negocio()` + 1 página/So componente enfocado**. Nada de
lógica de negocio en el cliente.

Leyenda: ✅ hecho · 🔶 parcial · ⬜ falta

---

## Estado actual (ya en v2, no rehacer)

| Módulo | Estado | Dónde |
|---|---|---|
| Tickets/órdenes (alta 2 pasos + seña, estados, notas, repuestos, cobro mixto, entrega, devolución seña) | ✅ | `panel/tickets`, RPCs `crear_orden_staff`, `cobrar_saldo_y_entregar`, `registrar_pago_orden`, `devolver_sena` |
| Portal público de consulta + portal por taller `/t/{slug}` | ✅ | `consulta`, `t/[slug]`, `crear_ticket`/`consultar_ticket` |
| POS + venta atómica + métodos de pago | ✅ | `panel/pos`, `registrar_venta` |
| Ventas (listado, paginación) | ✅ | `panel/ventas` |
| Caja: turnos, retiros, arqueo (resta retiros y pagos de orden) | ✅ | `panel/caja`, `abrir_turno`/`cerrar_turno`/`registrar_retiro` |
| Clientes CRUD + historial | ✅ | `panel/clientes`, `historial_cliente` |
| Inventario CRUD + stock crítico | ✅ | `panel/inventario` |
| Reportes por período + gráfico + método + top productos | ✅ | `panel/reportes`, `reporte_ventas`/`reporte_historial` |
| Dashboard (estilo CLOOP) + buscador global | ✅ | `panel/page.js`, `buscar_global` |
| Mercado Pago QR + Point + webhook + OAuth + suscripción SaaS | ✅/🔶 | `api/mp/*`, faltan credenciales reales |
| Facturación AFIP/ARCA (setup) | 🔶 | `arca_estado`/`arca_guardar`, tabla `facturas`; falta emisión real |
| Web Push orden nueva + PWA | ✅ | `api/push`, `lib/push.js` |
| Importar datos v1 | ✅ | `panel/importar` |
| Multi-tenant + roles por RLS + SaaS trial/pro | ✅ | tabla `negocios`, `mi_negocio()` |
| Comprobante imprimible (A4 doble / simple / 80mm) + etiqueta | ✅ | `panel/imprimir`, `panel/etiqueta` |

---

## FASE A — Cerrar el núcleo de reparaciones (máximo valor diario)

Construye sobre lo recién hecho. Todo dentro del detalle de orden en `panel/tickets`.

- ⬜ **Técnicos**: asignar técnico a la orden + vista "mis órdenes" del técnico.
  → columna `tickets.tecnico_id`; RPC `asignar_tecnico(p_ticket_id, p_tecnico_id)`; filtro
  "Asignadas a mí" en el listado. (v1: `/asignar-tecnico`, `/orden-tecnico`)
- ⬜ **Fotos del equipo al ingreso**: evidencia del estado físico. → bucket Storage
  `ordenes-fotos`, tabla `ticket_fotos`, RPCs `subir_foto`/`eliminar_foto`; galería en el
  detalle y en el comprobante. (v1: `/subir-foto`, `/eliminar-foto`)
- ⬜ **Costos y margen por orden**: cargar costo de repuestos + mano de obra → margen real de
  la reparación. → columnas de costo; RPC `guardar_costos_orden`. (v1: `/guardar-costos`)
- ⬜ **Etiquetas/tags** (urgente, garantía, esperando repuesto, avisar cliente): tabla
  `ticket_tags` + `toggle_tag`; chips de color en listado y detalle. (v1: `/toggle-tag`)
- ⬜ **Devolver equipo sin reparar** (distinto de devolver seña): marca estado + registra
  retiro sin cobro. → RPC `devolver_equipo`. (v1: `/devolver-equipo`)
- ⬜ **Editar orden completa** (datos de contacto, equipo, presupuesto) con validación.
  (v1: `/editar-orden`)
- ⬜ **Recordatorios de retiro**: bandeja de órdenes "Listas" sin retirar hace N días, con
  botón avisar. → vista `ordenes_para_recordar`. (v1: `/admin/recordatorios`)
- ⬜ **Comprobante público con token** compartible por link/WhatsApp (sin login).
  → columna `tickets.public_token`; página `/r/[token]`. (v1: `/comprobante-publico/<id>/<token>`)
- ⬜ **Exportar órdenes a CSV**. → RPC de export o generación client-side. (v1: `/exportar/ordenes/csv`)

## FASE B — Presupuestos y servicios

- ⬜ **Catálogo de servicios (mano de obra)**: "cambio de pantalla", "cambio de batería"…
  con precio por defecto, separado de productos. → tabla `servicios`; página
  `panel/servicios`; se pueden agregar al POS y a repuestos de orden. (v1: `/servicios`)
- ⬜ **Presupuestos / cotizaciones**: documento aparte de la orden, con ítems (productos +
  servicios), estado (borrador/enviado/aceptado/rechazado) y **conversión a orden** en un
  clic. → tablas `presupuestos`/`presupuesto_items`; RPCs `crear_presupuesto`,
  `convertir_presupuesto_en_orden`, `responder_presupuesto`; página `panel/presupuestos`.
  (v1: `/presupuestos`, `/presupuestos/<id>/convertir`)
- ⬜ **Sugerir presupuesto (IA)**: opcional, con Claude API a partir de la falla + histórico.
  (v1: `/api/sugerir-presupuesto`)

## FASE C — Caja completa y ventas

- ⬜ **Gastos del negocio** categorizados (alquiler, servicios, proveedores), separados de los
  retiros de caja. → tabla `gastos` + categorías; página `panel/gastos`; entran a reportes.
  (v1: `/gastos`)
- ⬜ **Movimientos de caja ingreso/egreso** manuales con motivo (hoy solo hay retiro/egreso).
  → generalizar `registrar_retiro` a `registrar_movimiento_caja(tipo, monto, motivo)`.
  (v1: `/registrar-movimiento-caja`)
- ⬜ **Anular venta** (con reposición de stock atómica) y **anular pago**. → RPCs
  `anular_venta`/`anular_pago` con reverso transaccional y traza. (v1: `/anular-venta`,
  `/anular-pago`) — *mejora sobre v1: reverso atómico verificado.*
- ⬜ **Editar / reimprimir venta**. (v1: `/editar-venta`, `/imprimir-venta`)
- ⬜ **Efectivo disponible en tiempo real** (widget en caja/POS). → RPC `efectivo_disponible`.
  (v1: `/api/efectivo-disponible`)

## FASE D — Equipo, permisos y stock

- ⬜ **Gestión de usuarios/operadores** desde el panel: invitar por email, asignar rol,
  activar/desactivar, eliminar. → Edge Function con service-role para crear usuarios de Auth;
  página `panel/usuarios` (solo dueño). (v1: `/usuarios`, `/usuarios/nuevo`, `/usuarios/editar`)
- ⬜ **Workflow de aprobaciones**: ciertas acciones del operador (borrar, cambiar precio,
  anular) quedan pendientes hasta que el dueño aprueba. → tabla `cambios_pendientes`; RPCs
  `solicitar_cambio`/`procesar_aprobacion`; página `panel/aprobaciones`. (v1: `/aprobaciones`)
  *Nota: evaluar si aporta o si RLS por rol ya alcanza — decidir con el usuario.*
- ⬜ **Ajuste de stock con motivo + historial** (merma, recuento, ingreso de mercadería).
  → tabla `movimientos_stock`; RPC `ajustar_stock`. (v1: `/ajustar-stock`)
- ⬜ **Fotos y categorías de producto**. (v1: `/producto/*/subir-foto`, `/admin/categorias`)

## FASE E — Facturación AFIP/ARCA (ya iniciada)

- 🔶 **Wizard de setup** (CUIT, certificado/CSR, punto de venta, condición IVA). Parcial.
- ⬜ **Emisión real** vía Edge Function con Afip SDK (lectura dinámica de cuenta activa),
  cola de facturas, **PDF** y **envío por WhatsApp**. (v1: `/admin/facturas/*`,
  `/admin/factura-setup/*`) — *mejora: emisión desde Edge Function server-side, nunca cliente.*

## FASE F — Comunicación · Bot PACHE (Fase 3 del roadmap)

- ⬜ **Bot WhatsApp (Cloud API) con IA** (Claude): responde consultas, estado de orden,
  precios. → Edge Function `webhook/whatsapp`; tablas `wa_conversaciones`, `wa_mensajes`.
  (v1: `/webhook/whatsapp`, `/api/wa/*`)
- ⬜ **Escalamiento a humano** (audio o pedido explícito → silencia bot 2 h) + bandeja con
  Realtime. (v1: `/api/wa/escalaciones/*`, `/api/wa/silenciar`)
- ⬜ **Respuestas rápidas + mejorar mensaje con IA** para el operador. (v1: `/api/wa/respuestas-rapidas`)
- ⬜ **Notificaciones de orden por WhatsApp** (presupuesto listo, equipo reparado).
  (v1: `/orden/<id>/notificar-wa`, `/presupuesto-wa`) — ya existe `lib/whatsapp.js` con link
  manual; automatizar vía Cloud API.
- ⬜ **Chat IA para el staff** (asistente interno). (v1: `/chat-ia`)

## FASE G — Fidelización y marketing

- ⬜ **Puntos de fidelización**: acumulación por compra, premios, canje, config de tasa.
  → tablas `puntos_movimientos`, `premios`; RPCs `acumular_puntos`/`canjear_premio`.
  (v1: `/admin/fidelizacion/*`, `/puntos`)
- ⬜ **Cupones de descuento** validables en POS y tienda. → tabla `cupones`; RPC `validar_cupon`.
  (v1: `/admin/cupones`, `/api/tienda/cupon`)
- ⬜ **Encuestas de satisfacción / NPS** post-entrega, con link por token y tablero.
  → tablas `encuestas`; página pública `/encuesta/[token]`. (v1: `/admin/encuestas`, `/encuesta/<token>`)
- ⬜ **Reactivación de clientes**: segmentar (sin compras hace N días) → campaña por WhatsApp
  con cola idempotente y lock TTL. (v1: `/reactivacion/*`) — *mejora: cola con constraint, sin duplicados.*

## FASE H — Vidriera (tienda) y B2B

- ⬜ **Tienda online pública** sobre el mismo inventario: catálogo, galería de fotos, ficha de
  producto, carrito, pedidos, reseñas. → páginas bajo `/t/{slug}/tienda`; tablas
  `pedidos_tienda`, `resenas`, `producto_galeria`. (v1: `/tienda`, `/api/tienda/*`, `/admin/tienda`,
  `/admin/pedidos-tienda`)
- ⬜ **Catálogo Meta/Facebook** (CSV/JSON) para sincronizar con la tienda de FB/IG.
  (v1: `/tienda/catalogo-meta.csv`)
- ⬜ **Gremio (mayorista B2B)**: portal para otros talleres con login propio, precios
  mayoristas, pedidos. → módulo separado bajo `/gremio`. (v1: `/gremio/*`, `/admin/gremio/*`)
- ⬜ **Dominios propios por taller** (config): subdominio gratis + dominio propio en plan Pro
  vía tabla `dominios` + API de Netlify + middleware. (diseñado, diferido)

## FASE I — Extras y pulido

- ⬜ **Dashboard en vivo (Realtime)**: ventas y órdenes en tiempo real. (v1: `/api/dashboard/live`)
- ⬜ **Centro de notificaciones** in-app (eventos recientes). (v1: `/api/notificaciones`)
- ⬜ **Páginas legales** privacidad / contacto (estáticas). (v1: `/privacidad`, `/contacto`)
- ⬜ **Multi-tema** (claro/oscuro conmutable) — hoy hay un tema CLOOP fijo. (v1: `/cambiar-tema`)
- ⬜ **Generar datos demo** para pruebas/onboarding. (v1: `/admin/generar-demo`)

---

## Fuera de paridad (obsoleto o resuelto por el stack)

- Backups manuales (`/admin/backup*`) → Supabase hace backups automáticos.
- `touch` al WSGI / `sw.js` servido a mano → deploy por push + PWA ya resuelta.
- Landings de marketing estáticas (`/pantallas`) → van a la web comercial, no al panel.

## Orden sugerido

A → B → C → D cierran la **paridad operativa** (lo que el taller usa todos los días).
E (facturación) según urgencia fiscal del usuario. F (bot) es el gran diferencial comercial.
G/H son crecimiento. I es pulido. Cada fase es independiente y se puede commitear/deployar sola.
