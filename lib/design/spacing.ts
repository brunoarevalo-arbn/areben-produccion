// Escala consistente de espaciado
export const spacing = {
  xs:  '0.25rem',  // 4px
  sm:  '0.5rem',   // 8px
  md:  '0.75rem',  // 12px
  base: '1rem',    // 16px
  lg:  '1.25rem',  // 20px
  xl:  '1.5rem',   // 24px
  '2xl': '2rem',   // 32px
  '3xl': '2.5rem', // 40px
  '4xl': '3rem',   // 48px
} as const;

// Presets comunes
export const padding = {
  card: 'px-6 py-4',           // padding interno de cards
  container: 'px-8 py-6',      // padding contenedores
  compact: 'px-3 py-2',        // compact (listas densas)
} as const;

export const gaps = {
  default: 'gap-4',
  compact: 'gap-2',
  loose: 'gap-6',
} as const;
