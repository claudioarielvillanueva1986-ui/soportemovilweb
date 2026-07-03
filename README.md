# Soporte Móvil v2 — Sistema de Gestión 🎫

Sistema de gestión del servicio técnico **Soporte Móvil**: tickets de reparación con seguimiento online, POS con control de stock, caja con arqueo, inventario y clientes. Roadmap completo en [ROADMAP.md](ROADMAP.md).

- **Frontend**: Next.js 15 (App Router) desplegado en **Vercel**
- **Backend**: **Supabase** (Postgres + RLS + Auth) — proyecto `soporte-movil` (`fzgvilcqkmdirxgtsilh`, región `sa-east-1`)

## Páginas

| Ruta | Descripción |
|---|---|
| `/` | Landing + formulario público para crear ticket (devuelve número `SM-XXXXXX`) |
| `/consulta` | Consulta pública de estado por número de ticket + email |
| `/panel` | Panel del staff (login con Supabase Auth): Resumen, POS, Caja, Inventario, Clientes y Reparaciones |
| `/panel/pos` | Punto de venta: carrito, métodos de pago, descuento de stock atómico |
| `/panel/caja` | Turnos de caja: apertura, retiros con motivo, cierre con arqueo y diferencia |
| `/panel/inventario` | Productos con SKU, precio/costo, stock y alerta de stock crítico |
| `/panel/tickets` | Gestión de reparaciones: estados, prioridades, notas internas y actualizaciones públicas |

## Arquitectura de seguridad

- Las tablas `tickets` y `ticket_actualizaciones` tienen **RLS activado**: solo usuarios autenticados (staff) acceden directo.
- El público **no** toca las tablas: crea tickets vía la RPC `crear_ticket()` y consulta vía `consultar_ticket()` (funciones `SECURITY DEFINER` con validación; la consulta exige número + email coincidentes).
- La clave publishable de Supabase incluida en el código es pública por diseño.

## Desplegar en Vercel (una sola vez)

1. Entrá a [vercel.com/new](https://vercel.com/new) e importá el repo `claudioarielvillanueva1986-ui/soportemovilweb`
2. Deploy — Vercel detecta Next.js automáticamente, sin configuración extra
3. A partir de ahí, cada push a `main` despliega solo

No hace falta configurar variables de entorno para el sistema base: la app trae la URL y la clave publishable de Supabase como valores por defecto (podés sobreescribirlas con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Mercado Pago — modelo OAuth (cada taller conecta su cuenta)

Los cobros del POS (QR/Point) van a la cuenta de MP **de cada taller**, conectada con 2 clics desde
Panel → Configuración → "Conectar con Mercado Pago" (OAuth). El sistema crea la caja para QR automáticamente
al conectar, renueva tokens solos, y el Point se elige pegando el ID del dispositivo.

Setup por única vez del **dueño del producto** (variables de entorno en Netlify):

| Variable | Qué es |
|---|---|
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | Credenciales de tu aplicación en [MP Developers](https://www.mercadopago.com.ar/developers) (activar OAuth y poner Redirect URL: `https://TU-DOMINIO/api/mp/oauth/callback`) |
| `MP_ACCESS_TOKEN` | Access token de TU cuenta — cobra las suscripciones del SaaS (preapproval) |
| `MP_WEBHOOK_SECRET` | Secreto compartido con la base (tabla `config_privada`) |
| `SUSCRIPCION_PRECIO` | Precio mensual del Plan Pro (default 20000) |

Webhook en el panel de MP: `https://TU-DOMINIO/api/mp/webhook` (eventos: pagos y suscripciones). Regla de diseño:
**el webhook nunca crea ventas** — solo registra pagos (antiduplicación por constraint); la venta la registra el POS.

## Facturación ARCA (por negocio)

Cada taller carga sus datos fiscales en Panel → Configuración → Facturación: CUIT, razón social, condición IVA,
punto de venta y certificado digital (se genera gratis con clave fiscal en el sitio de ARCA). Modo homologación →
producción. Los comprobantes se encolan en la tabla `facturas` (botón Facturar en Caja); la emisión con webservice
se activa por negocio cuando su configuración está completa.

## Desarrollo local

```bash
npm install
npm run dev   # http://localhost:3000
```

## Usuarios del panel

Los usuarios del staff se gestionan en Supabase → Authentication → Users. Ya existe un usuario administrador inicial (`admin@soportemovil.com.ar`); cambiá su contraseña desde el dashboard de Supabase cuanto antes.

## Estados de ticket

`nuevo` → `en_revision` → `en_reparacion` / `esperando_repuesto` → `listo` → `entregado` (o `cancelado`)

---

© Soporte Móvil — soportemovil.com.ar
