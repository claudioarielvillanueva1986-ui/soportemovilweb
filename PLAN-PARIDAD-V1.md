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
- ⬜ **Gestión de usuarios/operadores** (invitar por email, rol, activar/eliminar) — Edge Function.
- ⬜ **Workflow de aprobaciones** (cambios que requieren OK del dueño) — evaluar si aporta sobre RLS.
- ⬜ **Ajuste de stock con motivo + historial** (merma, recuento, ingreso).
- ⬜ **Fotos y categorías de producto**.

### Fase E — facturación AFIP/ARCA
- ✅ **Emisión real** delegada en Facturá (ARCA WSFE + PDF + CAE).
- ⬜ **Point/posnet** integrado: pendiente **en Facturá** (cobros API), luego enchufar al POS.

### Fase F — comunicación · bot PACHE
- ⬜ Bot WhatsApp (Cloud API) con IA (Claude), escalamiento a humano, respuestas rápidas,
  avisos de orden por WA, chat IA para el staff.

### Fase G — fidelización y marketing
- ⬜ Puntos/fidelización (acumular, premios, canje), cupones, encuestas NPS, reactivación de clientes.

### Fase H — vidriera y B2B
- ⬜ Tienda online pública + galería + pedidos + reseñas, catálogo Meta (CSV/JSON),
  gremio mayorista (B2B), dominios propios por taller.

### Fase I — extras y pulido
- ⬜ Dashboard en vivo (Realtime), centro de notificaciones, páginas legales, multi-tema,
  datos demo, **optimización mobile pantalla por pantalla**.

## Fuera de paridad (obsoleto)
Backups manuales (Supabase los hace), `touch` al WSGI, landings de marketing (van a la web comercial).
