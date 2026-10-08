// Íconos de línea del menú (reemplazan a los emojis). Trazo 1.9 sobre 24×24, toman el color del texto.
const PATHS = {
  inicio:       '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>',
  diseno:       '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  inventario:   '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  tijera:       '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  compras:      '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.5a2 2 0 0 0 2 1.5h7.7a2 2 0 0 0 2-1.6L21 8H6"/>',
  produccion:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  estamperia:   '<path d="M9 3h6v5l3 3H6l3-3Z"/><path d="M5 14h14v3H5zM7 20h10"/>',
  reposicion:   '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  calculadora:  '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
  costos:       '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.5-.6-3.1-1.6M12 6v2M12 16v2"/>',
  precios:      '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  gastos:       '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  configuracion:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
} as const;

export type NavIconName = keyof typeof PATHS;

export function NavIcon({ name, className = 'w-[17px] h-[17px]' }: { name: NavIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={`flex-shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
