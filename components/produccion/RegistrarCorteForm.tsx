'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TALLES_DEFAULT, TALLES_COMUNES } from '@/lib/validators/produccion';
import { calcTizada, type TizadaRollo } from '@/lib/produccion/tizada';
import { AviosSelector, type AvioOpt, type AvioSel } from '@/components/produccion/AviosSelector';
import { PegarDeMoldea } from '@/components/produccion/PegarDeMoldea';
import type { FichaMoldea } from '@/lib/produccion/moldea';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

interface RolloDisp {
  id: string; codigo: string; pesoActual: string; costoUnitario: string;
  insumo: { nombre: string; rinde: string | null }; color: { nombre: string } | null;
  colorProveedor?: string | null;
  compra?: { proveedor: { nombre: string } | null } | null;
}
interface CortadorOpt {
  id: string; nombre: string; activo: boolean;
}

type ConsumoRollo = TizadaRollo;

// Una ficha puede tener varias tizadas (cuerpo, puño, manga, complementos...).
// Cada tizada tiene su propia tela/rollos y su propio rinde. Las unidades cortadas
// son las mismas para todas (se cargan una vez en los talles).
interface Tizada {
  id: string;
  nombre: string;
  modo: 'tizada' | 'manual';
  metros: string;
  unidades: string;
  rollos: ConsumoRollo[];
  // Sublimación: si la tela de esta tizada se manda a sublimar, y cuántos metros se le
  // piden al sublimador (por defecto los que consume la tizada, pero editable — se paga
  // por lo pedido, no por lo cortado).
  sublima?: boolean;
  metrosSublimados?: string;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Estado del form serializado, para ver/editar una ficha idéntica a como se cargó.
export interface FichaData {
  tizadas: Tizada[];
  talles: Record<string, string>;
  avios: { etiquetaId: string; cantidad: number; nombre?: string }[];
  cortadorId?: string | null;
  costoCorte?: number | string;
  modoCosto?: 'total' | 'unidad';
  fechaCorte?: string; // YYYY-MM-DD
  // Avisos no bloqueantes de faltante por rinde, guardados como constancia en la ficha.
  faltantes?: { nombre: string; faltante: number }[];
  // Metros sublimados en total (traza; el desglose por tizada está en cada Tizada).
  metrosSublimados?: number;
  // La cargó el taller por el cortador (botón "+ Tizada"), no el cortador desde su panel.
  cargaInterna?: boolean;
  cargadaPor?: string;
}

const hoyISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

export interface CortePrefill {
  avios?: { etiquetaId: string; cantidad: number }[];
  cortadorId?: string | null;
  costoCorte?: number;
  modoCosto?: 'total' | 'unidad';
  talles?: { talle: string; cantidad: number }[];
  // Rinde del corte de la hermana (mismo molde): metros totales y unidades, para
  // derivar m/u. La tela (rollos) NO se copia; se elige la del color.
  tizada?: { metros: number; unidades: number };
  // Copiar de la hermana la RECETA de tizadas por separado (cada una con su rinde),
  // sin rollos. Reemplaza a `tizada` cuando la hermana tiene fichaCorteData.
  tizadasReceta?: { nombre: string; modo: 'tizada' | 'manual'; metros: string; unidades: string }[];
  // Editar la propia ficha: estado completo guardado (tizadas, rollos, etc.) → idéntico.
  fichaData?: FichaData;
}

// `cortadorBloqueado`: el corte está imputado a un pago. Cambiar de cortador mudaría la
// deuda a otra cuenta dejando el pago en la primera, así que el server lo rechaza; acá se
// deshabilita para que no se descubra al guardar.
export function RegistrarCorteForm({ ordenId, sku, cantidadPlanificada, marca, prefill, volverA, cortadorBloqueado = false }: { ordenId: string; sku: string; cantidadPlanificada: number; marca: string | null; prefill?: CortePrefill; volverA?: string; cortadorBloqueado?: boolean }) {
  const router = useRouter();
  const fd = prefill?.fichaData;
  const [rollosDisp, setRollosDisp] = useState<RolloDisp[]>([]);
  const [cortadores, setCortadores] = useState<CortadorOpt[]>([]);
  const [subPrecioMetro, setSubPrecioMetro] = useState(0); // $/m de sublimación (config)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editar: arranca de las tizadas guardadas (idénticas). Copiar hermana: la receta de
  // tizadas por separado (sin rollos). Si no, una tizada vacía (con el rinde si se copió).
  const initialTizadas: Tizada[] = fd?.tizadas?.length
    ? fd.tizadas
    : prefill?.tizadasReceta?.length
      ? prefill.tizadasReceta.map((t, i) => ({ id: `t${i + 1}`, nombre: t.nombre, modo: t.modo, metros: t.metros, unidades: t.unidades, rollos: [] }))
      : [{
          id: 't1', nombre: '', modo: 'tizada',
          metros:   prefill?.tizada?.metros   ? String(prefill.tizada.metros)   : '',
          unidades: prefill?.tizada?.unidades ? String(prefill.tizada.unidades) : '1',
          rollos: [],
        }];
  const tizadaSeq = useRef(initialTizadas.length + 1);
  const [tizadas, setTizadas] = useState<Tizada[]>(initialTizadas);
  const [aviosCatalogo, setAviosCatalogo] = useState<AvioOpt[]>([]);
  const [aviosSel, setAviosSel] = useState<AvioSel[]>(
    () => (fd?.avios ?? prefill?.avios ?? []).map((a) => ({ etiquetaId: a.etiquetaId, cantidad: String(a.cantidad) })),
  );
  const [filtroTela, setFiltroTela] = useState<Record<string, string>>({}); // por tizada → nombre de tela
  const [talles, setTalles] = useState<Record<string, string>>(
    () => fd?.talles ?? Object.fromEntries((prefill?.talles ?? []).map((t) => [t.talle, String(t.cantidad)])),
  );
  const [tallesExtra, setTallesExtra] = useState<string[]>([]); // talles opcionales agregados a mano
  const [cortadorId, setCortadorId] = useState(fd?.cortadorId ?? prefill?.cortadorId ?? '');
  const [costoCorte, setCostoCorte] = useState(fd?.costoCorte != null ? String(fd.costoCorte) : (prefill?.costoCorte ? String(prefill.costoCorte) : ''));
  const [modoCosto, setModoCosto] = useState<'total' | 'unidad'>(fd?.modoCosto ?? prefill?.modoCosto ?? 'total');
  const [fechaCorte, setFechaCorte] = useState<string>(fd?.fechaCorte ?? hoyISO());

  // La tarifa la define quien carga el corte (el cortador en su panel, o la diseñadora
  // a mano); no se autocompleta desde el cortador.
  const onCortadorChange = (id: string) => setCortadorId(id);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/rollos?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
      fetch('/api/cortadores').then((r) => r.ok ? r.json() : []),
    ]).then(([r1, r2, ct]) => {
      const allRollos = [...r1, ...r2] as RolloDisp[];
      const disp = allRollos.filter((r) => r.insumo.rinde && Number(r.insumo.rinde) > 0);
      // Editar: los rollos ya consumidos por esta ficha se muestran con su peso REPUESTO
      // (el guardado, previo al consumo), porque al guardar el backend repone y re-registra
      // atómico. Tienen prioridad sobre el peso vivo; los demás rollos vivos se agregan.
      if (fd?.tizadas?.length) {
        const vivos = new Map(allRollos.map((r) => [r.id, r]));
        const fichaRollos = new Map<string, RolloDisp>();
        for (const t of fd.tizadas) for (const c of t.rollos) {
          const vivo = vivos.get(c.rolloId);
          fichaRollos.set(c.rolloId, {
            id: c.rolloId, codigo: c.codigo,
            pesoActual: String(c.pesoActual), costoUnitario: String(c.costoUnitario),
            insumo: { nombre: c.nombre, rinde: String(c.rinde) },
            // De la ficha solo prevalece el peso repuesto: el color es del rollo vivo,
            // y si ya no está vivo, del que guardó la ficha.
            color: vivo?.color ?? (c.color ? { nombre: c.color } : null),
          });
        }
        const merged = [...fichaRollos.values(), ...disp.filter((r) => !fichaRollos.has(r.id))];
        setRollosDisp(merged.sort((a, b) => a.codigo.localeCompare(b.codigo)));
      } else {
        setRollosDisp(disp.sort((a, b) => a.codigo.localeCompare(b.codigo)));
      }
      setCortadores((ct as CortadorOpt[]).filter((c) => c.activo));
    });

    fetch('/api/costos/etiquetas')
      .then((r) => r.ok ? r.json() : [])
      .then((a) => { if (Array.isArray(a)) setAviosCatalogo(a.map((x) => ({ ...x, precio: Number(x.precio) }))); })
      .catch(() => {});

    fetch('/api/costos/sublimacion')
      .then((r) => r.ok ? r.json() : null)
      .then((c) => { if (c && typeof c.sublimacionPrecioMetro === 'number') setSubPrecioMetro(c.sublimacionPrecioMetro); })
      .catch(() => {});
  }, []);

  // Tizadas
  const addTizada = () =>
    setTizadas((prev) => [...prev, { id: `t${tizadaSeq.current++}`, nombre: '', modo: 'tizada', metros: '', unidades: '1', rollos: [] }]);
  const removeTizada = (id: string) =>
    setTizadas((prev) => prev.length > 1 ? prev.filter((t) => t.id !== id) : prev);
  const updTizada = (id: string, field: 'nombre' | 'modo' | 'metros' | 'unidades', val: string) =>
    setTizadas((prev) => prev.map((t) => t.id === id ? { ...t, [field]: val } : t));
  // Aplicar una tizada calculada por Moldea. Llega SIN rollos: los elige la
  // persona abajo, contra el inventario real.
  //
  // Las tizadas que ya tienen algo cargado no se pisan — se agregan al final.
  // Sí se descarta la tizada vacía que el form trae de arranque: dejarla haría
  // que la ficha se guarde con una tizada fantasma sin metros ni rollos.
  const aplicarMoldea = (f: FichaMoldea) =>
    setTizadas((prev) => {
      const vacia = (t: Tizada) => !t.nombre.trim() && !t.metros.trim() && t.rollos.length === 0;
      const quedan = prev.filter((t) => !vacia(t));
      const nuevas: Tizada[] = f.tizadas.map((t) => ({
        id: `t${tizadaSeq.current++}`, nombre: t.nombre, modo: t.modo, metros: t.metros, unidades: t.unidades, rollos: [],
      }));
      return [...quedan, ...nuevas];
    });
  // Al marcar "se sublima", precarga los metros que consume la tizada (editable después).
  const toggleSublima = (id: string, metrosDefault: number) =>
    setTizadas((prev) => prev.map((t) => t.id === id
      ? { ...t, sublima: !t.sublima, metrosSublimados: !t.sublima && !t.metrosSublimados && metrosDefault > 0 ? String(Math.round(metrosDefault * 100) / 100) : t.metrosSublimados }
      : t));
  const updMetrosSublimados = (id: string, val: string) =>
    setTizadas((prev) => prev.map((t) => t.id === id ? { ...t, metrosSublimados: val } : t));
  const toggleRolloTizada = (tizadaId: string, r: RolloDisp) =>
    setTizadas((prev) => prev.map((t) => {
      if (t.id !== tizadaId) return t;
      const exists = t.rollos.find((c) => c.rolloId === r.id);
      if (exists) return { ...t, rollos: t.rollos.filter((c) => c.rolloId !== r.id) };
      return { ...t, rollos: [...t.rollos, {
        rolloId: r.id, metros: '', codigo: r.codigo,
        pesoActual: Number(r.pesoActual), costoUnitario: Number(r.costoUnitario),
        rinde: Number(r.insumo.rinde), color: r.color?.nombre ?? null,
        nombre: `${r.insumo.nombre} · ${r.color?.nombre ?? 's/color'}${r.compra?.proveedor ? ` · ${r.compra.proveedor.nombre}` : ''}`,
      }] };
    }));
  const updRolloMetrosTizada = (tizadaId: string, rolloId: string, val: string) =>
    setTizadas((prev) => prev.map((t) => t.id === tizadaId
      ? { ...t, rollos: t.rollos.map((c) => c.rolloId === rolloId ? { ...c, metros: val } : c) } : t));

  // Talles
  const updateTalle = (talle: string, val: string) => setTalles((prev) => ({ ...prev, [talle]: val }));

  // Calculos
  const totalUnidades = Object.values(talles).reduce((s, v) => s + (parseInt(v) || 0), 0);

  const tizadasCalc = tizadas.map((t) => ({ t, ...calcTizada(t, totalUnidades) }));
  const totalRollosSel = tizadas.reduce((s, t) => s + t.rollos.length, 0);

  // Consumo agregado por rollo (un mismo rollo puede usarse en más de una tizada)
  const rolloAgg = new Map<string, { rolloId: string; metrosEf: number; codigo: string; rinde: number; pesoActual: number }>();
  for (const tc of tizadasCalc) {
    for (const c of tc.rollosCalc) {
      const cur = rolloAgg.get(c.rolloId);
      if (cur) cur.metrosEf += c.metrosEf;
      else rolloAgg.set(c.rolloId, { rolloId: c.rolloId, metrosEf: c.metrosEf, codigo: c.codigo, rinde: c.rinde, pesoActual: c.pesoActual });
    }
  }
  const rollosAgg = [...rolloAgg.values()];

  const totalMetros = tizadasCalc.reduce((s, x) => s + x.metros, 0);
  const totalKg     = tizadasCalc.reduce((s, x) => s + x.kg, 0);
  const costoTela   = tizadasCalc.reduce((s, x) => s + x.costo, 0);
  const costoCorteInput = parseFloat(costoCorte) || 0;
  const costoCorteNum = modoCosto === 'unidad' ? costoCorteInput * totalUnidades : costoCorteInput;
  // Sublimación: solo cuentan las tizadas marcadas. El $/m es el vigente (config); el server
  // recalcula con el mismo criterio, esto es solo el preview.
  const totalMetrosSublimados = tizadas.reduce((s, t) => s + (t.sublima ? (parseFloat(t.metrosSublimados || '') || 0) : 0), 0);
  const costoSublimacion = totalMetrosSublimados * subPrecioMetro;
  const costoTotalAcum = costoTela + costoCorteNum + costoSublimacion;
  const costoUnitario = totalUnidades > 0 ? costoTotalAcum / totalUnidades : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (totalRollosSel === 0) { setError('Selecciona al menos un rollo en alguna tizada'); return; }
    if (totalUnidades === 0) { setError('Cargá los talles para calcular el consumo'); return; }

    for (const tc of tizadasCalc) {
      if (tc.t.rollos.length === 0) continue;
      const etq = tc.t.nombre.trim() || 'sin nombre';
      if (tc.t.modo === 'tizada' && tc.metrosPorUnidad <= 0) { setError(`Tizada "${etq}": cargá los metros y unidades`); return; }
      // Una tizada se corta de un solo color. Solo se comparan colores CONOCIDOS: un rollo
      // sin color cargado no traba el guardado (un dato faltante no es un color distinto).
      const colores = [...new Set(tc.t.rollos
        .map((c) => rollosDisp.find((r) => r.id === c.rolloId)?.color?.nombre ?? c.color)
        .filter((n): n is string => !!n))];
      if (colores.length > 1) { setError(`Tizada "${etq}": mezcla telas de distinto color (${colores.join(', ')}). Una tizada se corta de un solo color.`); return; }
      // Un rollo asignado tiene que cortar algo: no se permiten rollos con 0 m de consumo.
      const sinUso = tc.rollosCalc.find((c) => c.metrosEf <= 0.001);
      if (sinUso) { setError(`Tizada "${etq}": el rollo ${sinUso.codigo} no consume nada (0 m). Quitalo — un rollo asignado tiene que cortar algo.`); return; }
    }

    // El faltante por rinde promedio NO traba: solo avisa. El rinde es un promedio
    // y a veces la tela rinde más. Se pide confirmación y queda como constancia en la ficha.
    const faltantes = tizadasCalc
      .filter((tc) => tc.t.rollos.length > 0 && tc.t.modo === 'tizada' && tc.faltante > 0.001)
      .map((tc) => ({ nombre: tc.t.nombre.trim() || 'sin nombre', faltante: tc.faltante }));

    // Rollos que realmente aportan metros (descarta seleccionados con consumo 0)
    const rollosFinal = rollosAgg.filter((c) => c.metrosEf > 0.001);
    if (rollosFinal.length === 0) { setError('Ningún rollo aporta metros al corte'); return; }
    for (const cr of rollosFinal) {
      if (cr.metrosEf / cr.rinde > cr.pesoActual + 0.001) { setError(`Rollo ${cr.codigo}: excede stock`); return; }
    }

    const cortesArr = Object.entries(talles)
      .map(([talle, val]) => ({ talle, cantidad: parseInt(val) || 0 }))
      .filter((t) => t.cantidad > 0);

    if (cortesArr.length === 0) { setError('Carga al menos un talle con cantidad'); return; }

    // Aviso no bloqueante: si según el rinde promedio no alcanza, se pide confirmar.
    if (faltantes.length > 0) {
      const detalle = faltantes.map((f) => `${f.nombre}: faltan ${fmt(f.faltante)} m`).join('\n');
      const ok = await confirmAsync({
        title: 'La tela podría no alcanzar',
        message: `Según el rinde promedio faltaría tela:\n${detalle}\n\nEl rinde es un promedio y a veces la tela rinde más. ¿Registrar el corte igual?`,
        confirmLabel: 'Registrar igual',
      });
      if (!ok) return;
    }

    setSaving(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/corte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumoRollos: rollosFinal.map((c) => ({ rolloId: c.rolloId, metrosUsados: c.metrosEf })),
        avios: aviosSel.length > 0 ? aviosSel.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: parseInt(a.cantidad) || 1 })) : undefined,
        cortesPorTalle: cortesArr,
        cortadorId: cortadorId || undefined,
        costoCorte: costoCorteNum > 0 ? costoCorteNum : undefined,
        metrosSublimados: totalMetrosSublimados > 0 ? totalMetrosSublimados : undefined,
        notas: notas || undefined,
        fechaCorte: fechaCorte || undefined,
        // Estado del form tal cual, para ver/editar la ficha idéntica después.
        fichaData: {
          tizadas,
          talles,
          avios: aviosSel.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: parseInt(a.cantidad) || 1, nombre: aviosCatalogo.find((x) => x.id === a.etiquetaId)?.nombre })),
          cortadorId: cortadorId || null,
          costoCorte,
          modoCosto,
          fechaCorte,
          faltantes,
          metrosSublimados: totalMetrosSublimados > 0 ? totalMetrosSublimados : undefined,
        },
      }),
    });

    if (r.ok) {
      router.push(volverA || `/produccion/${ordenId}`);
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Consumo de tela — una o más tizadas */}
      <Card padding="none" className="p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">1. Consumo de tela</h3>
        <p className="text-xs text-stone-400 mb-4">
          Una ficha puede tener varias tizadas (cuerpo, puño, manga, complementos). Cada una con su tela y su rinde.
          Las unidades cortadas se cargan una sola vez en los talles (sección 3).
        </p>

        {tizadas.map((t, ti) => {
          const tc = tizadasCalc[ti];
          const efMap = new Map(tc.rollosCalc.map((c) => [c.rolloId, c.metrosEf]));
          return (
            <div key={t.id} className="border border-stone-200 rounded-xl p-4 mb-3">
              {/* Nombre + quitar */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-stone-400 shrink-0">Tizada {ti + 1}</span>
                <input type="text" value={t.nombre} onChange={(e) => updTizada(t.id, 'nombre', e.target.value)}
                  placeholder="Nombre (ej: Cuerpo, Puño, Manga...)"
                  className="flex-1 text-sm font-semibold bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-amber-400 pb-0.5 text-stone-800" />
                {tizadas.length > 1 && (
                  <button type="button" onClick={() => removeTizada(t.id)}
                    className="text-stone-300 hover:text-red-400 transition text-xl shrink-0 leading-none">×</button>
                )}
              </div>

              {/* Modo */}
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => updTizada(t.id, 'modo', 'tizada')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${t.modo === 'tizada' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                  Por tizada
                </button>
                <button type="button" onClick={() => updTizada(t.id, 'modo', 'manual')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${t.modo === 'manual' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                  Metros por rollo
                </button>
              </div>

              {/* Inputs de tizada */}
              {t.modo === 'tizada' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">Metros de la tizada</label>
                      <NumInput value={parseFloat(t.metros) || 0} onChange={(n) => updTizada(t.id, 'metros', n ? String(n) : '')}
                        min="0" step="0.01" placeholder="Ej: 24.5" className={inpSm + ' w-full'} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">Unidades que rinde</label>
                      <NumInput value={parseFloat(t.unidades) || 0} onChange={(n) => updTizada(t.id, 'unidades', n ? String(n) : '')}
                        min="1" step="1" placeholder="Ej: 12" className={inpSm + ' w-full'} />
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-stone-600 flex flex-wrap gap-x-4 gap-y-1">
                    {tc.metrosPorUnidad > 0 && <span>Rinde: <strong>{fmt(tc.metrosPorUnidad)} m/u</strong></span>}
                    {totalUnidades === 0
                      ? <span className="text-amber-600">Cargá los talles (sección 3) para calcular los metros</span>
                      : tc.metrosPorUnidad > 0 && <span>Necesario: <strong>{fmt(tc.metrosPorUnidad)} m/u × {totalUnidades} u = {fmt(tc.metrosNecesarios)} m</strong></span>}
                  </div>
                  {tc.faltante > 0.001 && (
                    tc.t.rollos.length === 0
                      ? <p className="text-xs text-blue-700 mt-2">Elegí abajo el/los rollo(s) de esta tela — necesitás ~{fmt(tc.metrosNecesarios)} m.</p>
                      : <p className="text-xs text-amber-600 mt-2">Según el rinde promedio faltarían ~{fmt(tc.faltante)} m. Podés registrar igual (la tela puede rendir más) o sumar otro rollo.</p>
                  )}
                </div>
              )}

              {/* Sublimación: esta tela se manda a sublimar. Metros = los que se le piden al
                  sublimador (por defecto los de la tizada, editables — se paga lo pedido). */}
              <div className="mb-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer select-none">
                  <input type="checkbox" checked={!!t.sublima} onChange={() => toggleSublima(t.id, tc.metros)}
                    className="w-4 h-4 rounded border-stone-300 text-fuchsia-600 focus:ring-fuchsia-400" />
                  Esta tela se sublima
                </label>
                {t.sublima && (
                  <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3 mt-2">
                    <label className="text-xs font-semibold text-stone-600 mb-1 block">Metros a sublimar</label>
                    <div className="flex items-center gap-2">
                      <NumInput value={parseFloat(t.metrosSublimados || '') || 0} onChange={(n) => updMetrosSublimados(t.id, n ? String(n) : '')}
                        min="0" step="0.01" placeholder={tc.metros > 0 ? fmt(tc.metros) : 'Ej: 24.5'} className={inpSm + ' w-32'} />
                      {subPrecioMetro > 0
                        ? <span className="text-xs text-stone-500">× ${fmt(subPrecioMetro)}/m = <strong className="text-stone-700">${fmt((parseFloat(t.metrosSublimados || '') || 0) * subPrecioMetro)}</strong></span>
                        : <span className="text-xs text-amber-600">Cargá el precio por metro en Costos → Parámetros</span>}
                    </div>
                    <p className="text-xs text-stone-400 mt-1">Son los metros que le pedís al sublimador, no los que corta la tizada.</p>
                  </div>
                )}
              </div>

              {/* Filtro por tela: elegís la tela y ves solo sus rollos (en vez de todos). */}
              {(() => {
                const telas = [...new Set(rollosDisp.map((r) => r.insumo.nombre))].sort();
                return rollosDisp.length > 0 && telas.length > 1 ? (
                  <select value={filtroTela[t.id] || ''} onChange={(e) => setFiltroTela((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    className={`${inpSm} w-full mb-2`}>
                    <option value="">Todas las telas ({rollosDisp.length} rollos)</option>
                    {telas.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                ) : null;
              })()}
              {/* Rollos de esta tizada */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rollosDisp.length === 0 ? (
                  <p className="text-sm text-stone-400 py-2">No hay rollos con rinde disponibles. Cargá el rinde en configuración.</p>
                ) : (
                  (filtroTela[t.id]
                    // Un rollo ya tildado en esta tizada se muestra SIEMPRE, aunque no sea de
                    // la tela filtrada: si no, queda seleccionado pero invisible (y traba el
                    // guardado por "mezcla de colores" sin que se vea el rollo culpable).
                    ? rollosDisp.filter((r) => r.insumo.nombre === filtroTela[t.id] || t.rollos.some((c) => c.rolloId === r.id))
                    : rollosDisp).map((r) => {
                    const selected = t.rollos.find((c) => c.rolloId === r.id);
                    const metrosDisp = Number(r.pesoActual) * Number(r.insumo.rinde);
                    const ef = efMap.get(r.id) ?? 0;
                    return (
                      <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${selected ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
                        <input type="checkbox" checked={!!selected} onChange={() => toggleRolloTizada(t.id, r)} className="rounded border-stone-300 accent-amber-500" />
                        <span className="font-mono text-xs text-stone-700 w-16">{r.codigo}</span>
                        <span className="text-xs text-stone-600 flex-1 truncate">
                          {r.insumo.nombre} · {r.color?.nombre ?? <span className="text-stone-400">s/color</span>}
                          {r.compra?.proveedor && <span className="text-stone-500"> · {r.compra.proveedor.nombre}</span>}
                          {r.colorProveedor && <span className="text-stone-300"> · {r.colorProveedor}</span>}
                        </span>
                        <span className="text-xs text-stone-400 tabular-nums">{Number(r.pesoActual).toFixed(1)}kg · ~{metrosDisp.toFixed(0)}m</span>
                        {selected && (
                          t.modo === 'manual' ? (
                            <div className="flex items-center gap-1">
                              <NumInput value={parseFloat(selected.metros) || 0} onChange={(n) => updRolloMetrosTizada(t.id, r.id, n ? String(n) : '')}
                                min="0.01" step="0.01" placeholder="Metros" className={`w-24 ${inpSm}`} />
                              <span className="text-xs text-stone-400">m</span>
                            </div>
                          ) : (
                            ef > 0.001 ? (
                              <span className="text-xs font-semibold text-blue-700 tabular-nums w-24 text-right">{fmt(ef)} m</span>
                            ) : (
                              <span className="text-xs text-stone-400 italic w-24 text-right">no usado</span>
                            )
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Subtotal de la tizada */}
              {t.rollos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-3 gap-3 text-xs">
                  <div><span className="text-stone-500">Metros: </span><strong>{fmt(tc.metros)} m</strong></div>
                  <div><span className="text-stone-500">Equiv: </span><strong>{fmt(tc.kg)} kg</strong></div>
                  <div className="text-right"><span className="text-stone-500">Costo: </span><strong>${fmt(tc.costo)}</strong></div>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center flex-wrap">
          <button type="button" onClick={addTizada}
            className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">
            + Agregar tizada
          </button>
          <PegarDeMoldea onAplicar={aplicarMoldea} />
        </div>

        {totalRollosSel > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-200 grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-stone-500">Total tela: </span><strong>{fmt(totalMetros)} m</strong></div>
            <div><span className="text-stone-500">Equiv: </span><strong>{fmt(totalKg)} kg</strong></div>
            <div className="text-right"><span className="text-stone-500">Costo tela: </span><strong>${fmt(costoTela)}</strong></div>
          </div>
        )}
      </Card>

      {/* Avíos de la prenda (catálogo) */}
      <Card padding="none" className="p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">2. Avíos de la prenda</h3>
        <p className="text-xs text-stone-400 mb-4">
          Qué etiquetas/avíos del catálogo lleva cada prenda. El stock se descuenta solo al terminar la producción.
        </p>
        <AviosSelector aviosCatalogo={aviosCatalogo} marca={marca} aviosSel={aviosSel} setAviosSel={setAviosSel} totalUnidades={totalUnidades} />
      </Card>

      {/* Desglose por talles */}
      <Card padding="none" className="p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">3. Desglose por talle</h3>
        <p className="text-xs text-stone-400 mb-4">
          Cuantas prendas se cortaron de cada talle. El total reemplaza la cantidad planificada ({cantidadPlanificada}).
        </p>

        {(() => {
          const visibles = [...new Set([...TALLES_COMUNES, ...tallesExtra, ...Object.keys(talles).filter((t) => (parseInt(talles[t]) || 0) > 0)])]
            .sort((a, b) => (TALLES_DEFAULT as readonly string[]).indexOf(a) - (TALLES_DEFAULT as readonly string[]).indexOf(b));
          const agregables = [...TALLES_DEFAULT].filter((t) => !visibles.includes(t));
          return (
            <div className="flex flex-wrap gap-2 items-end">
              {visibles.map((t) => (
                <div key={t} className="w-16">
                  <label className="text-xs font-semibold text-stone-600 mb-1 block text-center">{t}</label>
                  <NumInput value={parseFloat(talles[t]) || 0} onChange={(n) => updateTalle(t, n ? String(n) : '')}
                    min="0" placeholder="0" className={`w-full text-center ${inpSm}`} />
                </div>
              ))}
              {agregables.length > 0 && (
                <select value="" onChange={(e) => { if (e.target.value) setTallesExtra((p) => [...p, e.target.value]); }}
                  className={`${inpSm} self-end`} title="Agregar talle">
                  <option value="">+ talle</option>
                  {agregables.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
          );
        })()}

        <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between text-sm">
          <span className="text-stone-500">
            Total cortadas: <strong className="text-stone-900 text-lg ml-1">{totalUnidades}</strong>
            {cantidadPlanificada > 0 && totalUnidades !== cantidadPlanificada && (
              <span className="ml-2 text-amber-600">(planificadas: {cantidadPlanificada})</span>
            )}
          </span>
          {totalUnidades > 0 && (
            <span className="text-stone-500">
              Costo unitario: <strong className="text-stone-900">${fmt(costoUnitario)}</strong>
            </span>
          )}
        </div>
      </Card>

      {/* Cortador + Costo */}
      <Card padding="none" className="p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">4. Servicio de corte</h3>
        <p className="text-xs text-stone-400 mb-4">Quien corto la tela y cuanto se le paga. El estado de pago arranca como PENDIENTE.</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cortador</label>
            <select value={cortadorId} onChange={(e) => onCortadorChange(e.target.value)} className={inp} disabled={cortadorBloqueado}>
              <option value="">-- Seleccionar --</option>
              {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {cortadorBloqueado && <p className="text-xs text-amber-700 mt-1">Bloqueado: el corte está imputado a un pago.</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Fecha de corte</label>
            <input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Modo de pago</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModoCosto('total')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoCosto === 'total' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                Total
              </button>
              <button type="button" onClick={() => setModoCosto('unidad')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoCosto === 'unidad' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                Por unidad
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
              {modoCosto === 'unidad' ? 'Costo por unidad' : 'Costo total del corte'}
            </label>
            <NumInput value={parseFloat(costoCorte) || 0} onChange={(n) => setCostoCorte(n ? String(n) : '')}
              min="0" step="0.01" placeholder="0" className={inp} />
            {modoCosto === 'unidad' && costoCorteInput > 0 && totalUnidades > 0 && (
              <p className="text-xs text-stone-500 mt-1">
                ${fmt(costoCorteInput)}/u × {totalUnidades} = <strong>${fmt(costoCorteNum)}</strong>
              </p>
            )}
            {modoCosto === 'unidad' && costoCorteInput > 0 && totalUnidades === 0 && (
              <p className="text-xs text-amber-600 mt-1">Cargá los talles para calcular el total</p>
            )}
          </div>
        </div>
      </Card>

      {/* Notas */}
      <Card padding="none" className="p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Notas</h3>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones, merma esperada, etc." className={`${inp} resize-none`} />
      </Card>

      {/* Resumen total */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
        <div className={`grid ${costoSublimacion > 0 ? 'grid-cols-5' : 'grid-cols-4'} gap-4 text-sm`}>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Tela</p>
            <p className="text-stone-800 tabular-nums">${fmt(costoTela)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Corte</p>
            <p className="text-stone-800 tabular-nums">${fmt(costoCorteNum)}</p>
          </div>
          {costoSublimacion > 0 && (
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Sublimación</p>
              <p className="text-stone-800 tabular-nums">${fmt(costoSublimacion)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Costo total</p>
            <p className="text-stone-900 font-bold text-lg tabular-nums">${fmt(costoTotalAcum)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Unidades</p>
            <p className="text-stone-900 font-bold text-lg">{totalUnidades}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="lg" isLoading={saving} disabled={totalRollosSel === 0 || totalUnidades === 0}>
          {saving ? 'Registrando...' : 'Registrar corte'}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
