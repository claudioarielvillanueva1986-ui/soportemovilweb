import { TiendaStore } from '@/components/tienda-store';
import { NEGOCIO_SLUG } from '@/lib/supabase';

export const metadata = {
  title: 'Soporte Móvil — Reparamos tu celular',
  description:
    'Reparación de celulares con garantía, accesorios y repuestos. Consultá el estado de tu equipo online y comprá desde la tienda.',
};

export default function Home() {
  return <TiendaStore slug={NEGOCIO_SLUG} />;
}
