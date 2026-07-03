# Soporte Móvil — Sistema de Tickets 🎫

Sistema web de soporte técnico de **Soporte Móvil**: los clientes crean tickets de reparación y siguen el estado online; el staff los gestiona desde un panel de administración.

- **Frontend**: Next.js 15 (App Router) desplegado en **Vercel**
- **Backend**: **Supabase** (Postgres + RLS + Auth) — proyecto `soporte-movil` (`fzgvilcqkmdirxgtsilh`, región `sa-east-1`)

## Páginas

| Ruta | Descripción |
|---|---|
| `/` | Landing + formulario público para crear ticket (devuelve número `SM-XXXXXX`) |
| `/consulta` | Consulta pública de estado por número de ticket + email |
| `/admin` | Panel de gestión (login con Supabase Auth): estados, prioridades, notas internas y actualizaciones públicas |

## Arquitectura de seguridad

- Las tablas `tickets` y `ticket_actualizaciones` tienen **RLS activado**: solo usuarios autenticados (staff) acceden directo.
- El público **no** toca las tablas: crea tickets vía la RPC `crear_ticket()` y consulta vía `consultar_ticket()` (funciones `SECURITY DEFINER` con validación; la consulta exige número + email coincidentes).
- La clave publishable de Supabase incluida en el código es pública por diseño.

## Desplegar en Vercel (una sola vez)

1. Entrá a [vercel.com/new](https://vercel.com/new) e importá el repo `claudioarielvillanueva1986-ui/soportemovilweb`
2. Deploy — Vercel detecta Next.js automáticamente, sin configuración extra
3. A partir de ahí, cada push a `main` despliega solo

No hace falta configurar variables de entorno: la app trae la URL y la clave publishable de Supabase como valores por defecto (podés sobreescribirlas con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

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
