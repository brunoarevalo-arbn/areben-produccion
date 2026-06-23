import { redirect } from 'next/navigation';

// La sección Lotes se retiró: los avíos se manejan en el Catálogo de avíos y las
// telas por Rollos. La ruta queda como redirect para no romper enlaces viejos.
export default function LotesPage() {
  redirect('/inventario');
}
