import { verificarEstado } from '@/lib/mp-server';
import {
  facturaConfigurado,
  canjearCodigoFactura,
  guardarConexionFactura,
  sincronizarEntitlement,
  baseRedirect,
} from '@/lib/factura-server';

// Vuelta del OAuth de Facturá: canjea el code por los tokens del partner,
// los guarda contra el negocio y —si el combo está activo— habilita la cuenta
// de Facturá. Luego vuelve a Configuración (mismo dominio, para no perder sesión).
export async function GET(request) {
  const url = new URL(request.url);
  const base = baseRedirect(url.origin);
  const volver = (extra) => Response.redirect(`${base}/panel/config${extra}`, 302);

  if (!facturaConfigurado()) return volver('?factura=error&detalle=sin-credenciales');

  const code = url.searchParams.get('code');
  const errorOAuth = url.searchParams.get('error');
  const negocioId = verificarEstado(url.searchParams.get('state'));

  if (errorOAuth) return volver(`?factura=error&detalle=${encodeURIComponent(errorOAuth).slice(0, 60)}`);
  if (!code || !negocioId) return volver('?factura=error&detalle=estado-invalido');

  try {
    // Debe ser IDÉNTICO al usado en /conectar (mismo dominio de producción)
    const redirectUri = `${base}/api/facturacion/callback`;
    const tokens = await canjearCodigoFactura(code, redirectUri);
    await guardarConexionFactura(negocioId, tokens);
    await sincronizarEntitlement(negocioId);
    return volver('?factura=ok');
  } catch (e) {
    return volver(`?factura=error&detalle=${encodeURIComponent(e.message).slice(0, 120)}`);
  }
}
