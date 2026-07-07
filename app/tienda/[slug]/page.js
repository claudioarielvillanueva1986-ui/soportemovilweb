'use client';

import { useParams } from 'next/navigation';
import { TiendaStore } from '@/components/tienda-store';

export default function TiendaPage() {
  const { slug } = useParams();
  return <TiendaStore slug={slug} />;
}
