# PROMPT FASE 1: SISTEMA DE COMPONENTES BASE

## Objetivo
Crear componentes reutilizables base que estandaricen el diseño en toda la app.
Estos componentes se usarán en TODAS las fases siguientes.

## Archivos creados
- `lib/design/spacing.ts` — escala de espaciado + presets (padding, gaps).
- `components/ui/Button.tsx` — variantes primary/secondary/danger/ghost, sizes sm/md/lg, isLoading.
- `components/ui/Input.tsx` — label, error, hint, fullWidth.
- `components/ui/Badge.tsx` — variantes default/success/warning/danger/info, sizes sm/md.
- `components/ui/Card.tsx` — padding compact/default/loose, noBorder.
- `app/globals.css` — tipografía base (h1/h2/h3/p) + estilo de links (amber), preservando dark mode, color de inputs y fix de autofill.

## Notas
- Los componentes son aditivos: no cambian la UI existente hasta que se usen en las fases siguientes.
- El único cambio visible global es `globals.css` (tipografía de headings sin clase explícita y color de links sin clase).
- Coexisten con el `NumInput` existente (`components/ui/NumInput.tsx`).
