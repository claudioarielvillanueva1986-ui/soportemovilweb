# Roadmap — Soporte Móvil v2

Recreación del sistema "Soporte Móvil v1" (Flask + SQLite + Alpine.js en PythonAnywhere) sobre el stack nuevo: **Next.js en Vercel + Supabase** (Postgres, Auth, RLS). El nombre comercial se define antes de salir a producción (solo afecta dominio, textos y logo).

## Decisiones de la v1 que se conservan

- **Descuento de stock atómico**: `UPDATE ... WHERE stock >= cantidad` con rollback total de la venta si falla — implementado en la RPC `registrar_venta` (Postgres, transaccional). Nunca stock negativo.
- **Regla del webhook de Mercado Pago**: solo el POS inserta ventas/actualiza señas; el webhook únicamente factura (Fase 2).
- **Antiduplicación de pagos**: mejorada — `UNIQUE` constraint en `ventas.mp_payment_id` (antes era lógica de aplicación).
- **Adaptadores de pasarela (PSPPagos)** para sumar otros PSP (Fase 2).
- **Escalamiento a humano del bot** ante audio, con silencio temporal del bot (Fase 3).
- **Cola idempotente con lock TTL** para reactivación de clientes (Fase 3).
- **Alertas de stock crítico** bajo umbral configurable por producto (`stock_minimo`).
- **Dos lenguajes visuales** (Premium minimal vs Operacional bold) — pendiente de aplicar al refinar UI.
- **Mobile-first** para operadores (~70% uso móvil) + PWA instalable (Fase 3).

## Mejoras estructurales sobre la v1

- SQLite → **Postgres** con transacciones reales y **RLS por rol** (dueño / operador): la separación de permisos se aplica en la base, no solo en la UI.
- El público nunca toca tablas: solo RPCs `SECURITY DEFINER` validadas (`crear_ticket`, `consultar_ticket`).
- El **arqueo de caja descuenta retiros** (v1 no los restaba): esperado = inicial + ventas efectivo − retiros.
- Deploy por push (Vercel) en lugar de `touch` al WSGI; backups automáticos de Supabase en lugar de copias manuales.
- Secretos en variables de entorno, nunca en código.

## Modelo de negocio: SaaS por suscripción

El producto se vende a talleres/servicios técnicos bajo suscripción mensual (plan `trial` de 14 días → `pro`).
**Multi-tenant desde la base**: tabla `negocios`, columna `negocio_id` en todas las tablas operativas y RLS que
aísla cada negocio a nivel de base de datos (verificado con tests de aislamiento bidireccional). Registro
self-service en `/registro` (el trigger de Auth crea negocio + perfil dueño desde metadata). Cada negocio tiene
su portal público de órdenes en `/t/{slug}`.

Diferenciales frente a la competencia: portal de seguimiento online para los clientes del taller, arqueo de caja
real (con retiros), stock atómico, Mercado Pago integrado (QR + Point) con antiduplicación por constraint,
roles aplicados por RLS, y próximamente bot de WhatsApp con IA.

Monetización implementada: suscripción mensual vía Mercado Pago preapproval (`/api/mp/suscribir` + webhook
`subscription_preapproval` → RPC `saas_actualizar_suscripcion`), enforcement del trial en las RPCs operativas
(`abrir_turno` rechaza con prueba vencida), pantalla de bloqueo en el panel y página `/panel/plan` con historial.
Precio configurable con la env var `SUSCRIPCION_PRECIO` (default $20.000/mes). Pendiente: probar con el
`MP_ACCESS_TOKEN` real del dueño del producto.

## Fases

### ✅ Fase 0 — Tickets de reparación
- [x] Portal público: crear ticket (`SM-XXXXXX`) y consultar estado por número + email
- [x] Gestión de tickets con estados, prioridades, notas internas y actualizaciones públicas

### ✅ Fase 1 — Núcleo operativo
- [x] Perfiles con roles (dueño/operador) creados automáticamente al dar de alta usuarios en Supabase Auth
- [x] Clientes (CRUD)
- [x] Inventario: productos con categoría, SKU, precio/costo, stock, umbral crítico, activo
- [x] POS: carrito, métodos de pago (efectivo/transferencia/tarjeta/MP QR/MP Point), venta atómica
- [x] Caja: turnos, retiros con motivo, cierre con arqueo y diferencia
- [x] Panel unificado `/panel` con navegación (Resumen, POS, Caja, Inventario, Clientes, Reparaciones)

### 🔶 Fase 2 — Dinero (código listo; falta cargar credenciales)
- [x] Mercado Pago QR dinámico: `/api/mp/qr` + tabla `cobros_mp` + QR en pantalla del POS con espera de pago
- [x] Mercado Pago Point: `/api/mp/point` (intención de pago en terminal)
- [x] Webhook MP `/api/mp/webhook`: nunca crea ventas, solo registra pagos; antiduplicación por `UNIQUE (mp_payment_id)` en `pagos_mp` y en `ventas`
- [x] Señas / pagos parciales en tickets (`ticket_pagos`, UI en detalle de reparación)
- [x] Cola de facturación (`facturas`, botón 🧾 en Caja)
- [ ] **Pendiente de credenciales**: cargar variables `MP_*` en Vercel (ver README) y probar con cuenta real
- [ ] Emisión real AFIP/ARCA vía Afip SDK desde Edge Function (requiere CUIT + certificado), lectura dinámica de cuenta activa

### Fase 3 — Comunicación
- [ ] Bot PACHE: WhatsApp Cloud API + Edge Function + Claude API (tablas `wa_conversaciones`, `wa_escalaciones`)
- [ ] Escalamiento a humano (audio → silenciar bot 2h) y bandeja con Realtime
- [ ] Reactivación de clientes: query builder + cola idempotente con lock TTL
- [ ] Web Push (VAPID + Service Worker) con upsert correcto (`ON CONFLICT`)
- [ ] PWA instalable para operadores

### Fase 4 — Vidriera y gestión
- [ ] Tienda online pública (`/tienda`) sobre el mismo inventario
- [ ] Dashboard gerencial con Realtime (ventas en vivo, margen por costo, top productos)
- [ ] Reportes por período y exportación

## Infraestructura

- **Repo**: `claudioarielvillanueva1986-ui/soportemovilweb` → deploy automático en Vercel desde `main`
- **Supabase**: proyecto `soporte-movil` (`fzgvilcqkmdirxgtsilh`, `sa-east-1`)
- **Usuarios staff**: Supabase → Authentication → Users (el perfil y rol se crean solos; rol se cambia en la tabla `perfiles`)
