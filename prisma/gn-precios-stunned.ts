// Carga en Gestión Nube el PROVEEDOR y el PRECIO de los 13 productos del lanzamiento de
// Stunned. GN es la que empuja a Tienda Nube: a Tienda Nube ⛔ no se le escribe directo.
//
// 🔴 Los 13 están HOY en $1,00 y ACTIVOS. Doce se crearon el 7-sep 17:54 sin proveedor
// (por eso la sincronización no los veía: el cliente filtra por proveedor propio) y el
// treceavo, CIRCLE BROWN, existe desde abril ya con proveedor STUNNED.
//
// 🔑 EL id NO SE ESCRIBE A CIEGAS: antes de tocar nada, el script LEE cada producto y
// verifica que el nombre sea el que espera. Un id equivocado le pondría el precio de una
// remera a otra cosa, y eso ⛔ no se nota mirando un 200.
//
// 🔑 Y un 200 no alcanza: GN devuelve el producto actualizado, así que se compara lo que
// volvió contra lo que se pidió. "Lo cargué y se revirtió solo" es el modo de falla
// clásico de esta integración (mismo criterio que `api/_liquidacion.js` del monitor).
//
// ⚠️ Tope de la API: 60 llamadas por minuto. Va con pausa y con reintento ante 429.
//
//   npx tsx prisma/gn-precios-stunned.ts                      → dry-run: lee y compara
//   npx tsx prisma/gn-precios-stunned.ts --aplicar-proveedor  → escribe SOLO el proveedor
//   npx tsx prisma/gn-precios-stunned.ts --aplicar-precio     → escribe SOLO el precio
//   npx tsx prisma/gn-precios-stunned.ts --aplicar-proveedor --aplicar-precio
import 'dotenv/config';

const BASE = 'https://www.gestionnube.com/api/v1';
const PROVEEDOR = 'STUNNED';
const PAUSA = 1200; // ms entre llamadas (tope 60/min)
const APLICAR_PROV = process.argv.includes('--aplicar-proveedor');
const APLICAR_PRECIO = process.argv.includes('--aplicar-precio');

// id · nombre esperado · precio definitivo (Bruno, 7-sep-2026). El nombre es el SEGURO:
// si no coincide, ese producto se saltea.
const PRODUCTOS: { id: number; nombre: string; precio: number }[] = [
  { id: 1097609, nombre: 'REMERA SKATE',          precio: 41990 },
  { id: 913520,  nombre: 'REMERA CIRCLE BROWN',   precio: 37990 },
  { id: 1097608, nombre: 'REMERA TIME',           precio: 37990 },
  { id: 1097606, nombre: 'REMERA GRAPH',          precio: 37990 },
  { id: 1097607, nombre: 'REMERA MADE',           precio: 37990 },
  { id: 1097604, nombre: 'REMERA STARRY',         precio: 37990 },
  { id: 1097605, nombre: 'REMERA LONG BROWN',     precio: 36990 },
  { id: 1097610, nombre: 'REMERA LONG OFF WHITE', precio: 36990 },
  { id: 1097603, nombre: 'BUZO FLECK',            precio: 74990 },
  { id: 1097611, nombre: 'BUZO MADE',             precio: 71990 },
  { id: 1097602, nombre: 'BUZO PHRASE',           precio: 69990 },
  { id: 1097601, nombre: 'BUZO STND',             precio: 66990 },
  { id: 1097600, nombre: 'CAMPERA WEAR',          precio: 81990 },
];

interface GnProd { id: number; name: string; provider: string; retailer_price: string; active: number }

// 🔴 EL TOKEN DE ESTE REPO NO ESCRIBE. `GESTIONNUBE_TOKEN` (51 caracteres, de la
// generación vieja) lee perfecto y contesta **403 «Invalid ability provided»** en
// cualquier PATCH: es el mensaje de Sanctum cuando al token le falta la ability, o sea
// que no es el campo ni el producto, es el token.
// El que escribe es el de la tienda ZATTIA del monitor (`GN_TOKEN_ZATTIA`, 52
// caracteres) — el mismo con el que `api/_liquidacion.js` pisa precios promocionales.
// Stunned es una LÍNEA de Zattia, así que sus productos viven en esa cuenta.
// ⛔ El token no se pega en ningún lado: se pasa por entorno leyéndolo del archivo.
function token(): { valor: string; de: string } {
  const z = process.env.GN_TOKEN_ZATTIA;
  if (z) return { valor: z, de: 'GN_TOKEN_ZATTIA (tienda Zattia — escribe)' };
  const g = process.env.GESTIONNUBE_TOKEN;
  if (g) return { valor: g, de: 'GESTIONNUBE_TOKEN (este repo — SOLO LEE: los PATCH van a dar 403)' };
  throw new Error('No hay token: pasá GN_TOKEN_ZATTIA por entorno');
}
const H = () => ({ Authorization: `Bearer ${token().valor}`, Accept: 'application/json', 'Content-Type': 'application/json' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = (n: number) => '$' + n.toLocaleString('es-AR');

async function llamar(path: string, init?: RequestInit): Promise<{ status: number; cuerpo: string }> {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${BASE}${path}`, { ...init, headers: H() });
    const cuerpo = await r.text();
    if (r.status === 429) { await sleep(4000 * (i + 1)); continue; }
    return { status: r.status, cuerpo };
  }
  return { status: 429, cuerpo: 'la API siguió contestando 429 después de 5 intentos' };
}

/** Lee un producto por su id, buscándolo por nombre (GET /productos/{id} no existe en esta API). */
async function leer(nombre: string, id: number): Promise<GnProd | null> {
  const { status, cuerpo } = await llamar(`/productos/obtener?per_page=50&q=${encodeURIComponent(nombre)}`);
  if (status !== 200) { console.log(`   ⛔ no se pudo leer (HTTP ${status})`); return null; }
  try { return (JSON.parse(cuerpo).data as GnProd[]).find((p) => p.id === id) ?? null; } catch { return null; }
}

async function main() {
  const t = token();
  console.log(`token: ${t.de}`);
  if (!process.env.GN_TOKEN_ZATTIA && (APLICAR_PROV || APLICAR_PRECIO)) {
    console.error('\n⛔ Sin GN_TOKEN_ZATTIA los PATCH van a dar 403 «Invalid ability provided». Pasalo por entorno:');
    console.error('   GN_TOKEN_ZATTIA=$(grep \'^GN_TOKEN_ZATTIA=\' ~/Projects/monitor-areben/.env | cut -d= -f2- | tr -d \'"\') npx tsx prisma/gn-precios-stunned.ts --aplicar-precio\n');
    process.exit(1);
  }
  const modo = APLICAR_PROV || APLICAR_PRECIO
    ? `ESCRIBE ${[APLICAR_PROV && 'proveedor', APLICAR_PRECIO && 'precio'].filter(Boolean).join(' + ')}`
    : 'DRY-RUN (no escribe nada)';
  console.log(`${modo} · ${PRODUCTOS.length} productos · pausa ${PAUSA}ms entre llamadas\n`);

  let ok = 0, saltados = 0, fallados = 0;
  for (const p of PRODUCTOS) {
    const antes = await leer(p.nombre, p.id);
    await sleep(PAUSA);
    if (!antes) { console.log(`⛔ ${p.nombre.padEnd(24)} id ${p.id}: NO APARECE con ese nombre. Salteado.`); saltados++; continue; }
    // El seguro: el id tiene que ser el de ESE nombre. Si no, no se toca.
    if (antes.name.trim().toUpperCase() !== p.nombre.toUpperCase()) {
      console.log(`⛔ ${p.nombre.padEnd(24)} id ${p.id} se llama "${antes.name}". NO se toca.`); saltados++; continue;
    }
    const precioActual = parseFloat(antes.retailer_price) || 0;
    console.log(`${p.nombre.padEnd(24)} id ${p.id} · hoy: proveedor "${antes.provider}" · ${$(precioActual)} · activo ${antes.active}`);
    console.log(`   quedaría: proveedor "${PROVEEDOR}" · ${$(p.precio)}`);

    const cambios: Record<string, unknown> = {};
    if (APLICAR_PROV && antes.provider !== PROVEEDOR) cambios.provider = PROVEEDOR;
    if (APLICAR_PRECIO && Math.round(precioActual) !== p.precio) cambios.retailer_price = p.precio;
    if (!Object.keys(cambios).length) { if (APLICAR_PROV || APLICAR_PRECIO) console.log('   (ya estaba como corresponde)'); continue; }

    const { status, cuerpo } = await llamar(`/productos/${p.id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
    await sleep(PAUSA);
    if (status !== 200) { console.log(`   ⛔ GN contestó ${status}: ${cuerpo.slice(0, 160)}`); fallados++; continue; }
    // No alcanza el 200: se mira lo que devolvió el propio PATCH.
    let d: Partial<GnProd> = {};
    try { d = JSON.parse(cuerpo).data ?? {}; } catch { /* cuerpo raro: cae al chequeo de abajo */ }
    const provOk = cambios.provider === undefined || (d.provider ?? '') === PROVEEDOR;
    const precioOk = cambios.retailer_price === undefined || Math.round(parseFloat(String(d.retailer_price ?? 0))) === p.precio;
    // Sólo se informa lo que se PIDIÓ cambiar: GN no devuelve los campos que no tocaste, y
    // escribir «proveedor "undefined"» al lado de un ✅ se lee como si lo hubiera borrado.
    if (provOk && precioOk) {
      const puesto = [cambios.provider !== undefined && `proveedor "${d.provider}"`, cambios.retailer_price !== undefined && `$${d.retailer_price}`].filter(Boolean).join(' · ');
      console.log(`   ✅ escrito y verificado: ${puesto}`); ok++;
    }
    else { console.log(`   🔴 200 PERO NO QUEDÓ: devolvió proveedor "${d.provider}" · precio ${d.retailer_price}. El campo no se acepta o se revirtió.`); fallados++; }
  }
  console.log(`\n${ok} escritos y verificados · ${saltados} salteados · ${fallados} fallados`);
  if (!APLICAR_PROV && !APLICAR_PRECIO) console.log('Esto fue un dry-run. Para escribir: --aplicar-proveedor y/o --aplicar-precio');
}
main();
