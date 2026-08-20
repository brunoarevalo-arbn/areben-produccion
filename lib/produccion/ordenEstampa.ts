// Un ítem de orden de estampa nace de dos lados distintos y se nombra distinto:
//   · reposición  → un producto de Gestión Nube que ya se vende (`gnId` / `gnNombre`)
//   · lanzamiento → una estampa que todavía no existe en GN (`estampaId`)
// La regla vive acá y no repartida en cada pantalla: la usan el listado, el remito y
// el `motivo` del movimiento de stock, que es lo que después se lee en la base.

export interface ItemNombrable {
  gnId: number | null;
  gnNombre: string | null;
  estampa?: { codigoInterno: string; nombreComercial: string | null } | null;
}

export function nombreItemOrden(it: ItemNombrable): string {
  if (it.estampa) {
    const { codigoInterno, nombreComercial } = it.estampa;
    return nombreComercial?.trim() ? `${codigoInterno} · ${nombreComercial.trim()}` : codigoInterno;
  }
  if (it.gnNombre?.trim()) return it.gnNombre.trim();
  if (it.gnId != null) return `Producto ${it.gnId}`;
  return 'Sin producto';
}
