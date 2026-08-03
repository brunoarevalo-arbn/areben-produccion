/**
 * Fotos de moodboard: `Idea.fotos`, `ProyectoDiseno.moodboard` y `Lanzamiento.fotos`.
 *
 * Las tres son columnas de TEXTO con un JSON adentro. El formato viejo era un array
 * plano de URLs; el nuevo lleva además la descripción de cada foto ("me gusta el
 * modelo del top pero no los brillos"), para no descartar una idea por no entenderla.
 *
 * `parseFotos` acepta las dos formas — un elemento string se lee como foto sin
 * descripción — así que no hace falta migrar la base: cada idea se pasa sola al
 * formato nuevo la primera vez que se guarda.
 *
 * Nadie hace `JSON.parse` de estos campos a mano: todo pasa por acá.
 * (`IteracionMuestra.fotos` queda afuera: sigue siendo un textarea de links sueltos.)
 */
export interface Foto {
  url: string;
  descripcion?: string | null;
}

/** Cualquier forma guardada → siempre `Foto[]`. Nunca tira: ante basura, devuelve []. */
export function parseFotos(raw: unknown): Foto[] {
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((item): Foto[] => {
    // Formato viejo: el elemento ES la URL.
    if (typeof item === 'string') return item ? [{ url: item, descripcion: null }] : [];
    if (item && typeof item === 'object' && typeof (item as Foto).url === 'string') {
      const f = item as Foto;
      if (!f.url) return [];
      const d = typeof f.descripcion === 'string' ? f.descripcion.trim() : '';
      return [{ url: f.url, descripcion: d || null }];
    }
    return [];
  });
}

/** `Foto[]` → el string que va a la columna (null si quedó vacío, como hasta ahora). */
export function serializeFotos(fotos: unknown): string | null {
  const limpias = parseFotos(fotos);
  return limpias.length ? JSON.stringify(limpias) : null;
}

/** Solo las URLs — para miniaturas y para lo que todavía piensa en `string[]`. */
export function urlsDeFotos(fotos: Foto[]): string[] {
  return fotos.map((f) => f.url);
}
