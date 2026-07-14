'use client';

import { useState } from 'react';

// Copia al portapapeles el resumen del escandallo (texto listo para WhatsApp), para
// enviar a administración sin tener que generar PDF ni imprimir.
export function CopiarResumen({ texto, label = '📋 Copiar resumen', compact = false }: { texto: string; label?: string; compact?: boolean }) {
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

  return compact ? (
    <button onClick={copiar}
      className={`text-xs px-3 py-1.5 rounded-lg border transition ${copiado ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}>
      {copiado ? '✓ Copiado' : label}
    </button>
  ) : (
    <button onClick={copiar}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${copiado ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}>
      {copiado ? '✓ Copiado' : label}
    </button>
  );
}
