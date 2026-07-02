'use client';

import { useState } from 'react';

// Copia al portapapeles el resumen del escandallo (texto listo para WhatsApp), para
// enviar a administración sin tener que generar PDF ni imprimir.
export function CopiarResumen({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Fallback para navegadores sin permiso de clipboard.
      const ta = document.createElement('textarea');
      ta.value = texto; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <button onClick={copiar}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${copiado ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}>
      {copiado ? '✓ Copiado' : '📋 Copiar resumen'}
    </button>
  );
}
