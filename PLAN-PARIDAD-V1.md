# Plan de paridad con v1 — Soporte Móvil v2 (estado vivo)

Reimplementar todo lo útil del `app.py` de v1 (235 rutas), mejor y sin sus bugs, sin
volver a un monolito. Regla: **cada función = pocas RPCs `SECURITY DEFINER` scopeadas por
`mi_negocio()` + una página/So componente enfocado**. Nada de lógica de negocio en el cliente.

Leyenda: ✅ hecho · 🔶 parcial · ⬜ falta

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
- ⬜ **H2 — pago online con Mercado Pago** en el checkout (reactivar MP / ruteo del cobro).
- ⬜ Reseñas de producto, catálogo Meta (CSV/JSON), gremio mayorista (B2B), dominios propios.

### Fase I — extras y pulido
- ⬜ Dashboard en vivo (Realtime), centro de notificaciones, páginas legales, multi-tema,
  datos demo, **optimización mobile pantalla por pantalla**.

## Fuera de paridad (obsoleto)
Backups manuales (Supabase los hace), `touch` al WSGI, landings de marketing (van a la web comercial).
