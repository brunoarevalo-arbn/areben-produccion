'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 rounded-xl text-sm font-semibold transition"
    >
      Imprimir / Guardar PDF
    </button>
  );
}
