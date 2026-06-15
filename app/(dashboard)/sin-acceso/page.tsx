import Link from 'next/link';

export default function SinAccesoPage() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-lg font-bold text-stone-800 mb-1">Sin acceso a esta sección</h1>
        <p className="text-sm text-stone-500 mb-5">
          No tenés permiso para ver esta parte del sistema. Si creés que deberías tenerlo,
          pedile a un administrador que te lo habilite.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
