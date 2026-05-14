import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function DisenoPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Diseño</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Proyectos</h1>
        <p className="text-stone-500 text-sm mt-1">La nueva vista Kanban llega en el próximo cambio.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/diseno/fases-catalogo"
          className="block bg-white border-2 border-violet-200 hover:border-violet-400 rounded-2xl p-6 transition">
          <div className="text-3xl mb-3">🏷</div>
          <h2 className="font-bold text-stone-800 text-base">Catálogo de fases</h2>
          <p className="text-stone-500 text-sm mt-1">Tela, ficha, corte, confección, lavadero, bordado…</p>
        </Link>
        <Link href="/diseno/molderias"
          className="block bg-white border-2 border-stone-200 hover:border-stone-400 rounded-2xl p-6 transition">
          <div className="text-3xl mb-3">📐</div>
          <h2 className="font-bold text-stone-800 text-base">Molderías</h2>
          <p className="text-stone-500 text-sm mt-1">Catálogo de molderías disponibles.</p>
        </Link>
        <Link href="/diseno/telas"
          className="block bg-white border-2 border-stone-200 hover:border-stone-400 rounded-2xl p-6 transition">
          <div className="text-3xl mb-3">🧵</div>
          <h2 className="font-bold text-stone-800 text-base">Telas</h2>
          <p className="text-stone-500 text-sm mt-1">Catálogo de telas disponibles.</p>
        </Link>
      </div>
    </div>
  );
}
