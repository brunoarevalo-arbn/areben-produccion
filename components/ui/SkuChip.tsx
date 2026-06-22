// Chip monoespaciado para SKU/abreviaturas. Antes reimplementado a mano 4×.
export function SkuChip({ sku, className = '' }: { sku: string; className?: string }) {
  return (
    <span className={`font-mono text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded ${className}`}>
      {sku}
    </span>
  );
}
