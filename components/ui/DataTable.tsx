import React from 'react';

// Tabla/lista densa reutilizable. Encapsula el patrón repetido en toda la app:
// contenedor Card + header sticky-ish + filas con densidad estándar (py-3).
// `cols` es el template de grid (ej. "auto 1fr auto"); se comparte entre header y filas.

export function DataTable({ cols, header, children, className = '' }: {
  cols: string;
  header?: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-stone-200 overflow-hidden ${className}`}>
      {header && (
        <div className="px-4 md:px-5 py-2.5 bg-stone-50 border-b border-stone-100 grid gap-2 md:gap-3 text-xs font-bold uppercase tracking-widest text-stone-400"
          style={{ gridTemplateColumns: cols }}>
          {header.map((h, i) => <span key={i}>{h}</span>)}
        </div>
      )}
      {children}
    </div>
  );
}

export function DataTableRow({ cols, children, className = '', onClick }: {
  cols: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`px-4 md:px-5 py-3 grid gap-2 md:gap-3 items-center border-t border-stone-100 hover:bg-stone-50 transition ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ gridTemplateColumns: cols }}>
      {children}
    </div>
  );
}
