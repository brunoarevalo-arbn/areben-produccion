'use client';

import { useState } from 'react';

interface MenuItem { label: string; onClick: () => void; danger?: boolean }

// Menú "⋮" reutilizable para agrupar acciones secundarias de una fila y no saturarla.
export function PopoverMenu({ items, label = '⋮' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Más acciones" aria-expanded={open}
        className="text-sm px-2 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition leading-none">
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-1 z-50 min-w-[9rem] bg-white border border-stone-200 rounded-xl shadow-lg py-1">
            {items.map((it, i) => (
              <button key={i} type="button" onClick={() => { setOpen(false); it.onClick(); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-stone-50 transition ${it.danger ? 'text-red-600' : 'text-stone-700'}`}>
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
