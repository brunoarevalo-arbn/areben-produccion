import { redirect } from 'next/navigation';

// El historial de compras es uno solo: el módulo Compras (unificado: compras de
// tela con stock + gastos/compras a proveedor). Esta ruta redirige allá; el alta
// de compra de tela con stock sigue en /inventario/compras/nueva.
export default function ComprasInventarioPage() {
  redirect('/compras');
}
