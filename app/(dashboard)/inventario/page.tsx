import Link from 'next/link';
import { InsumosClient } from '@/components/inventario/InsumosClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

const ACCESOS = [
  { label: 'Telas',              desc: 'Stock de telas (rollos por kg).',                href: '/inventario?cat=tela' },
  { label: 'Avíos',              desc: 'Etiquetas, badanas, hilos y avíos.',             href: '/inventario/catalogo/avios' },
  { label: 'Alta de insumos',    desc: 'Dar de alta un insumo o avío nuevo.',            href: '/inventario/catalogo' },
  { label: 'Producto terminado', desc: 'Stock de prendas por SKU y talle + ajuste.',     href: '/inventario/terminado' },
  { label: 'Rollos',             desc: 'Vista plana de rollos con estado y peso.',        href: '/inventario/rollos' },
  { label: 'Movimientos',        desc: 'Auditoría de ingresos, consumos y ajustes.',      href: '/inventario/movimientos' },
  { label: 'Ajustes',            desc: 'Corregir stock o costo a mano (sin compra).',     href: '/inventario/ajustes' },
];

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Inventario" title="Inventario" subtitle="Telas, avíos y producto terminado, todo en un solo lugar." />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-10">
        {ACCESOS.map((a) => (
          <Link key={a.href} href={a.href}
            className="block rounded-2xl border-2 border-stone-200 hover:border-stone-400 p-4 transition bg-white">
            <h2 className="font-bold text-stone-800 text-sm">{a.label}</h2>
            <p className="text-stone-500 text-xs mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>

      <InsumosClient categoriaInicial={cat ?? ''} />
    </div>
  );
}
