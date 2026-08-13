// Leer una ficha de Moldea (el tizador propio, repo aparte `areben-moldea`).
//
// Moldea calcula la tizada y escupe un JSON con la forma de `fichaCorteData.tizadas[]`.
// Acá se lo valida antes de dejarlo entrar al form de corte.
//
// 🔑 **Moldea PROPONE, el taller CONFIRMA.** Esto sólo prellena el formulario: el
// consumo lo sigue registrando `registrarCorteOrden` cuando la persona guarda,
// con los rollos que ELIGE acá. Moldea no sabe qué hay en el depósito y no manda
// ningún rollo, así que nada de esto puede mover stock por su cuenta.
//
// La validación es dura a propósito. Los metros que entran acá terminan en un
// `MovimientoInsumo` y en el costo de la prenda, y el modo de falla de todo el
// tizador es SILENCIOSO: un número diez veces chico da una ficha que se guarda
// bien, con un costo verosímil, y el error aparece en la mesa de corte.

export interface TizadaMoldea {
  nombre: string;
  modo: 'tizada' | 'manual';
  metros: string;
  unidades: string;
  rollos: never[];
}

export interface FichaMoldea {
  moldea: number;
  tizadas: TizadaMoldea[];
  corrida?: {
    anchoRolloMm?: number;
    anchoTizableMm?: number;
    orilloMm?: number;
    tela?: string;
    capas?: number;
    metrosPorPrenda?: number;
    m2PorPrenda?: number;
    aprovechamiento?: number;
    largoTizadaM?: number;
    calibracion?: { grillaMm?: number; toleranciaMm?: number };
  };
  avisos: string[];
  revisar: boolean;
}

// El formato que este lector entiende. Moldea escribe el suyo en `moldea`. Si
// algún día no coinciden, es mejor negarse que interpretar mal un campo que
// cambió de significado.
export const FORMATO_SOPORTADO = 1;

// Una prenda que consume más de 50 m o menos de 1 cm no es una prenda: es una
// escala equivocada (un DXF en pulgadas leído como mm sale 25 veces chico, uno
// en cm leído como mm sale 10 veces). No es una validación de negocio, es la red
// contra el error que no falla.
const M_POR_PRENDA_MIN = 0.01;
const M_POR_PRENDA_MAX = 50;

type Resultado = { ok: true; ficha: FichaMoldea } | { ok: false; error: string };

export function leerFichaMoldea(texto: string): Resultado {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, error: 'Pegá el contenido de <molde>-ficha.json' };

  let crudo: unknown;
  try {
    crudo = JSON.parse(limpio);
  } catch {
    return { ok: false, error: 'Eso no es JSON válido. Copiá el archivo entero, desde la primera llave hasta la última.' };
  }

  if (typeof crudo !== 'object' || crudo === null) {
    return { ok: false, error: 'El JSON tiene que ser un objeto.' };
  }
  const o = crudo as Record<string, unknown>;

  // El campo `moldea` es la marca de origen. Sin él puede ser cualquier JSON: no
  // se adivina que "un objeto con tizadas" viene del tizador.
  if (typeof o.moldea !== 'number') {
    return { ok: false, error: 'Este JSON no viene de Moldea (le falta el campo "moldea"). Generalo con: node bin/tizar.js <molde>.dxf --ancho N --json' };
  }
  if (o.moldea !== FORMATO_SOPORTADO) {
    return { ok: false, error: `Moldea escribió el formato ${o.moldea} y acá se entiende el ${FORMATO_SOPORTADO}. Actualizá uno de los dos en vez de pegarlo igual.` };
  }

  if (!Array.isArray(o.tizadas) || o.tizadas.length === 0) {
    return { ok: false, error: 'El JSON no trae ninguna tizada.' };
  }

  const tizadas: TizadaMoldea[] = [];
  for (const [i, t] of (o.tizadas as unknown[]).entries()) {
    const et = `Tizada ${i + 1}`;
    if (typeof t !== 'object' || t === null) return { ok: false, error: `${et}: no es un objeto.` };
    const x = t as Record<string, unknown>;

    const nombre = typeof x.nombre === 'string' ? x.nombre.trim() : '';
    if (!nombre) return { ok: false, error: `${et}: sin nombre. Es cómo se identifica la tela en la ficha.` };

    const metros = parseFloat(String(x.metros));
    const unidades = parseInt(String(x.unidades), 10);
    if (!Number.isFinite(metros) || metros <= 0) return { ok: false, error: `${et} («${nombre}»): los metros tienen que ser un número mayor que 0, vino "${String(x.metros)}".` };
    if (!Number.isInteger(unidades) || unidades < 1) return { ok: false, error: `${et} («${nombre}»): las unidades tienen que ser un entero de 1 para arriba, vino "${String(x.unidades)}".` };

    // La cuenta que después hace `calcTizada`. Si da absurda, lo dice acá y no
    // cuando ya se guardó el movimiento de stock.
    const porPrenda = metros / unidades;
    if (porPrenda < M_POR_PRENDA_MIN || porPrenda > M_POR_PRENDA_MAX) {
      return {
        ok: false,
        error: `${et} («${nombre}»): da ${porPrenda.toFixed(4)} m por prenda (${metros} m ÷ ${unidades} u), que no es un consumo posible. Revisá la escala del molde en Moldea antes de pegarlo.`,
      };
    }

    // El modo lo fija Moldea en 'tizada' (metros + unidades, que producción
    // escala). 'manual' fijaría metros por rollo, y Moldea no elige rollos.
    tizadas.push({ nombre, modo: 'tizada', metros: String(metros), unidades: String(unidades), rollos: [] });
  }

  const avisos = Array.isArray(o.avisos) ? (o.avisos as unknown[]).map(String) : [];

  return {
    ok: true,
    ficha: {
      moldea: o.moldea,
      tizadas,
      corrida: (typeof o.corrida === 'object' && o.corrida !== null ? o.corrida : undefined) as FichaMoldea['corrida'],
      avisos,
      // `revisar` lo manda Moldea, pero no se le cree a ciegas: si hay avisos,
      // hay que leerlos aunque el archivo diga que no.
      revisar: o.revisar === true || avisos.length > 0,
    },
  };
}
