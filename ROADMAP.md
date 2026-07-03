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

### Fase 2 — Dinero
- [ ] Mercado Pago QR dinámico (API route + tabla de QR activo)
- [ ] Mercado Pago Point (Newland N950 o equivalente)
- [ ] Webhook MP (ruta serverless) con la regla solo-facturar y antiduplicación por constraint
- [ ] Facturación AFIP/ARCA vía Afip SDK desde Edge Function (certificados en secrets), lectura dinámica de cuenta activa
- [ ] Señas / pagos parciales en tickets de reparación

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
