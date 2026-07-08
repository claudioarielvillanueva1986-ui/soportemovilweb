# Plan de paridad con v1 — Soporte Móvil v2 (estado vivo)

Reimplementar todo lo útil del `app.py` de v1 (235 rutas), mejor y sin sus bugs, sin
volver a un monolito. Regla: **cada función = pocas RPCs `SECURITY DEFINER` scopeadas por
`mi_negocio()` + una página/So componente enfocado**. Nada de lógica de negocio en el cliente.

Leyenda: ✅ hecho · 🔶 parcial · ⬜ falta

---

## 📌 Decisión (2026-07): Soporte Móvil NO se vende como SaaS

Soporte Móvil deja de ser un producto multi-tenant a la venta (a diferencia de Facturá).
Es el sistema de gestión de este negocio, con la tienda pública como frontend — igual que v1.

- **Dominio raíz (`/`)** = la tienda pública (antes era una landing de venta). El panel
  interno queda atrás en `/panel`, sin login expuesto en portada.
- **Eliminado**: `/registro`, `/panel/plan` (planes combo + suscripción mensual),
  `/api/mp/suscribir`, el gate de "prueba vencida" que podía bloquear el panel, y la rama
  de webhook de MP para suscripciones del SaaS (`preapproval`). El resto de Mercado Pago
  (cobros de la tienda/POS vía OAuth de cada taller) sigue intacto.
- **Branding real**: logo de v1 (`logo.png`, favicon, íconos PWA) integrado en la tienda,
  el panel y el manifest. Tabla `tienda_config` ahora soporta personalización propia:
  `logo_url` (subida desde `/panel/tienda`), `color_acento`, `banner_titulo/subtitulo`,
  `instagram` — pensado para si en el futuro se abre otra sucursal/marca, no para vender
  el software a terceros.
- **Deuda técnica aceptada**: quedan en la base (sin uso) las tablas/RPCs `suscripciones`,
  `precio_plan`, `actualizar_plan`, `saas_actualizar_suscripcion` — inofensivas, se pueden
  limpiar más adelante si hace falta.

## 🎨 Identidad de marca real (2026-07)

El usuario pasó una foto del local físico y el archivo original del logo (alta resolución,
"SP" en negro/cian + "Soporte Móvil"). Se detectó que **tienda y panel usaban paletas
distintas y ninguna era la marca real**: la tienda tenía un cian genérico (`#00E5FF`,
heredado del HTML de v1) y el panel un verde-lima (`#c2f04a`) sin relación con el negocio.

- **Logo real integrado**: se le quitó el fondo blanco de verdad (des-matteo sobre blanco
  conocido) → `public/logo.png` con transparencia real. Se recortó además solo la marca
  "SP" para favicon/PWA (mucho más legible a tamaño chico que el logo completo).
- **Color de marca unificado**: `#0097D9` (azul/cian exacto, muestreado por píxel del logo
  real) como `--accent` único en toda la app (tienda + panel), reemplazando el cian
  genérico y el lima. Decisión del usuario: sin amarillo, "colorido y que se distinga bien
  todo" → se separó `--ok` (verde `#34d399`, éxito) de `--accent` (antes eran el mismo
  color en el panel, confundía estados con marca); colores categóricos (métodos de pago,
  estados de presupuesto) mantienen su paleta multicolor existente.
- **Bug de fondo corregido**: varios botones/badges de la tienda tenían el cian
  **hardcodeado** (`#00E5FF` directo, no `var(--accent)`), por lo que el `color_acento`
  personalizable desde `/panel/tienda` no los afectaba. Ahora todo pasa por la variable.
- Fondos neutros del panel pasaron de tinte oliva (`#191c16`, `#22261c`...) a tinte
  azul-noche (`#131a24`, `#1a2330`...), coherente con el navy de la tienda.

---

## ✅ Ya hecho (base + esta tanda)

**Núcleo (Fases 0–4 previas):** tickets/órdenes, portal público `/t/{slug}`, POS + venta
atómica, ventas, caja con arqueo real, clientes, inventario, reportes, dashboard CLOOP,
buscador global, web push, PWA, import v1, multi-tenant + RLS, comprobantes/etiquetas.

**Pagos de órdenes:** seña al alta, cobro de saldo con **pago mixto**, entrega, devolución
de seña, todo integrado a la caja.

**Ecosistema Facturá (hub de facturación + cobros):**
- Partner API en `factura-app` (OAuth de partner, `/api/partners/facturas`, `/cobros`,
  `/negocio`, `/entitlement`, webhook saliente firmado).
- Conexión "Conectar con Facturá" con instructivo (MP + ARCA se configuran en Facturá).
- **Planes combo**: base $19.999 (2 sucursales incl.), add-on Facturá +$6.000, sucursal
  adicional +$5.000; una sola suscripción + entitlement.
- **POS cobra por QR** con la cuenta MP conectada en Facturá; la venta queda en la caja.
- **Facturación ARCA auto/manual** con CAE + PDF (en POS y en `/panel/ventas`).

**Fase A (órdenes) parcial:** ✅ técnicos (asignar + filtro "Mías") · ✅ etiquetas/tags ·
✅ costos y margen por orden · ✅ devolver equipo sin reparar.

**UI/UX:** scrollbars y controles nativos acordes al tema (todo el sistema), POS
búsqueda-primero, mobile (sin overflow horizontal, inputs sin zoom en iOS).

---

## ⬜ Lo que falta (por fase, en orden sugerido)

### Fase A — cerrar el núcleo de reparaciones
- ⬜ **Fotos del equipo al ingreso** (evidencia de estado). Storage bucket `ordenes-fotos`,
  tabla `ticket_fotos`, subir/eliminar; galería en detalle y comprobante.
- ⬜ **Editar orden completa** (contacto, equipo, presupuesto) con validación.
- ⬜ **Recordatorios de retiro**: bandeja de órdenes "Listas" sin retirar hace N días + avisar.
- ⬜ **Comprobante público con token** (link compartible sin login): `tickets.public_token` + `/r/[token]`.
- ⬜ **Exportar órdenes a CSV**.

### Fase B — presupuestos y servicios ✅
- ✅ **Catálogo de servicios** (mano de obra con precio) — `/panel/servicios`, se suma al POS y a presupuestos.
- ✅ **Presupuestos/cotizaciones** con ítems y **conversión a orden** — `/panel/presupuestos`.
- ⬜ **Sugerir presupuesto (IA)** (opcional, Claude API).

### Fase C — caja y ventas completas ✅
- ✅ **Gastos** categorizados y **movimientos de caja** ingreso/egreso con motivo — tabla `movimientos_caja` + `registrar_movimiento`.
- ✅ **Anular venta** (reposición de stock atómica) — `anular_venta` (dueño); arqueo excluye anuladas.
- ✅ **Reimprimir venta** — `/panel/imprimir-venta/[id]` (editar = anular + rehacer).
- ✅ **Efectivo disponible** en vivo — arqueo de caja incluye ventas efectivo, movimientos y retiros.

### Fase D — equipo, permisos y stock
- ✅ **Gestión de usuarios/operadores** — Edge Function `equipo` (alta con email+contraseña, sin depender de SMTP), rol/activar por RLS, baja; `/panel/usuarios` (dueño). Trigger `proteger_ultimo_dueno` impide dejar el negocio sin dueño activo; `mi_negocio()`/`es_dueno()` bloquean a usuarios inactivos.
- ⬜ **Workflow de aprobaciones** (cambios que requieren OK del dueño) — evaluar si aporta sobre RLS.
- ✅ **Ajuste de stock con motivo + historial** (merma, recuento, ingreso) — `movimientos_stock` + `ajustar_stock`.
- ✅ **Fotos y categorías de producto**: categorías ya existían; fotos con `producto_fotos` +
  `registrar_foto_producto`/`eliminar_foto_producto` (bucket `ordenes-fotos`), subida con compresión y galería en el editor de Inventario.

### Fase E — facturación AFIP/ARCA
- ✅ **Emisión real** delegada en Facturá (ARCA WSFE + PDF + CAE).
- ⬜ **Point/posnet** integrado: pendiente **en Facturá** (cobros API), luego enchufar al POS.

### Fase F — comunicación
- ✅ **Avisar cliente por WhatsApp** (TODOS los talleres): botones "recibido" y "listo"
  que abren WhatsApp con el mensaje armado (wa.me, gratis, sin API). Plantillas
  configurables por negocio (`wa_aviso_recibido`/`wa_aviso_listo`, `set_avisos_whatsapp`).
- 🔒 **PACHE (bot IA, Cloud API + Claude)**: SOLO para el negocio dueño — gateado por
  `negocios.bot_ia` (true solo en el negocio del dueño). Escalamiento a humano, respuestas
  rápidas, chat IA para el staff. Los demás clientes solo tienen el botón de avisar. ⬜ Construir.

### Fase G — fidelización y marketing
- ✅ **Puntos/fidelización "Soporte Puntos"**: `fidelizacion_config` (activo, puntos_por_mil),
  `puntos_movimientos`, `premios`; acreditación automática en `registrar_venta_pos`, `saldo_puntos`,
  `canjear_premio`; página `/panel/fidelizacion` (config + premios + canje + movimientos) y saldo/estimado en el POS.
- ✅ **Cupones** (código, % o monto, mínimo, usos, vencimiento): tabla `cupones`, `validar_cupon`,
  aplicación atómica en `registrar_venta_pos` (suma uso, guarda código en la venta), página `/panel/cupones` y campo de cupón en el POS.
- ✅ **Encuestas NPS** por orden: tabla `encuestas` + RPCs `crear_encuesta`/`encuesta_ver`/`responder_encuesta`;
  página pública `/encuesta/[token]` (estrellas general/rapidez/atención + recomendaría + comentario) y
  `/panel/encuestas` (KPIs, generar link por orden + enviar por WhatsApp, listado de respuestas).
- 🚫 Reactivación de clientes: **fuera del plan** (decisión del usuario).

### Fase H — vidriera y B2B
- 🔶 **Tienda online (H1 hecho)**: `tienda_config` + `productos.en_tienda` + `pedidos_tienda`;
  RPCs `tienda_publica`/`crear_pedido_tienda`/`pedido_estado`. Página pública `/tienda/[slug]`
  (catálogo con fotos, carrito, checkout → pedido + WhatsApp), panel `/panel/tienda` (config) y
  `/panel/pedidos` (gestión de estados), toggle "Publicar en la tienda" en Inventario.
- ✅ **H2 — pago online con Mercado Pago** vía Facturá: `pedidos_tienda.cobro_id` + RPCs con secreto
  (`pedido_para_pago`/`pedido_set_cobro`/`pedido_marcar_pagado`); rutas públicas `/api/tienda/pagar`
  (crea el cobro con `facturaFetch → /api/partners/cobros`) y `/api/tienda/pago-estado` (polling que marca
  pagado); botón "Pagar online" en el checkout con polling. Requiere el MP del taller conectado en Facturá.
- ✅ **Reseñas de producto**: `producto_resenas` + RPCs `producto_tienda` (detalle con galería + reseñas
  aprobadas + rating) y `crear_resena` (queda pendiente); modal de detalle en la tienda con galería,
  reseñas y formulario; moderación (aprobar/rechazar) en `/panel/tienda`.
- ⬜ Catálogo Meta (CSV/JSON), gremio mayorista (B2B), dominios propios.

### Fase I — extras y pulido
- ✅ **Centro de notificaciones en tiempo real** (Realtime): `tickets` y `pedidos_tienda` en la
  publicación `supabase_realtime`; componente `NotificacionesCentro` (campana + toasts) que avisa
  órdenes y pedidos nuevos sin recargar, respetando RLS por negocio.
- ⬜ Órdenes/lista con vistas cards/tabla/kanban ✅ (hecho en el rediseño). Falta: páginas legales,
  multi-tema, datos demo, **optimización mobile pantalla por pantalla**.

## Fuera de paridad (obsoleto)
Backups manuales (Supabase los hace), `touch` al WSGI, landings de marketing (van a la web comercial).

---

## Auditoría v1 → v2 (2026-07, con el repo v1 completo a la vista)

v1 = 235 rutas en `app.py`. Comparado contra las páginas/RPCs de v2. Estado real:

### ✅ Con paridad (núcleo completo)
Órdenes (alta, detalle, estados, técnicos, tags, costos, **repuestos**, **notas internas**,
**fotos del equipo** `registrar_foto_ticket`, pagos, seña, entregar-y-cobrar, devolver seña,
devolver equipo, comprobante público con token), POS (venta atómica, validar stock, cupón,
fidelización, QR de cobro por Facturá), caja (arqueo, movimientos, gastos, efectivo disponible),
ventas (anular, reimprimir, editar), inventario (fotos, ajuste de stock con motivo, categorías),
clientes, servicios, presupuestos (+ convertir), reportes + margen, dashboard + realtime,
buscador global, usuarios/equipo (Edge Function), fidelización + cupones + encuestas,
**tienda pública (ahora idéntica a v1, con fotos migradas)**, pedidos de tienda, pago online,
reseñas, WhatsApp/PACHE (bandeja, toma humana, escalaciones, respuestas rápidas, bloquear),
facturación ARCA (delegada a Facturá), planes/suscripción, PWA + web push.

### 🔶 Parcial (existe pero incompleto)
- **Editar orden completa**: v2 edita notas y costos; falta editor completo de contacto/equipo/presupuesto (`/editar-orden`).
- **Caja QR pantalla dedicada** (`/caja-qr`): el cobro QR está, falta la pantalla de espera a pantalla completa.

### ⬜ Falta (verificado, ordenado por impacto)
1. ~~Gremio / Mayorista B2B~~ — **🚫 EXCLUIDO por decisión del usuario.**
2. **/pantallas** — landing “Consulta por cambio de módulos 100% originales” (linkeada desde el nav de la tienda).
3. **Recordatorios de retiro** — bandeja de órdenes listas sin retirar N días + avisar (`/admin/recordatorios`).
4. **Exportar a CSV** — órdenes y reportes (`/exportar/ordenes/csv`, `/reportes/exportar/csv`).
5. **Inteligencia de ventas** — analítica avanzada (`/admin/inteligencia-ventas`).
6. **Buzón de mensajes + form de contacto** — el formulario de la tienda entra a un inbox (`/contacto`, `/admin/mensajes`).
7. **Página pública “Mis puntos”** — el cliente ve su saldo de fidelización (`tienda_premios`/`/puntos`).
8. **Catálogo Meta** (CSV/JSON) para Facebook/Instagram Shopping (`/tienda/catalogo-meta.*`).
9. **Chat IA para staff** (`/chat-ia`) y **sugerir presupuesto con IA** (`/api/sugerir-presupuesto`).
10. **Páginas legales** — privacidad/términos (`/privacidad`).
11. **Datos demo** (`/admin/generar-demo`) y **multi-tema / modo claro** (`toggle-fondo`/`cambiar-tema`).
12. **Autocompletar DNI** de cliente (`/api/buscar-cliente-dni`), **imagen de teléfono** (`/api/imagen-telefono`) — menores.
13. **Point (posnet) físico** de Mercado Pago — pendiente en Facturá, luego enchufar al POS.
14. **Dominios propios** para la tienda.

### 🚫 Fuera de plan / resuelto distinto
Reactivación de clientes (excluida por decisión), backups manuales (Supabase),
wizard de certificados ARCA y wizard de cuentas MP (se hacen **dentro de Facturá**, no en Soporte Móvil).
