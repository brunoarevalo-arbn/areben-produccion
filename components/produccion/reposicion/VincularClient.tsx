'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';

interface GnProd { gnId: number; code: string | null; name: string; provider: string; category: string | null; skuLiso: string | null; }

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function VincularClient() {
  const [productos, setProductos] = useState<GnProd[]>([]);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [lisosSugeridos, setLisosSugeridos] = useState<string[]>([]);
  const [filtro, setFiltro] = useState('');
  const [soloSinVincular, setSoloSinVincular] = useState(false);
  const [asignSku, setAsignSku] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const cargar = useCallback(async () => {
    const r = await fetch('/api/reposicion/productos');
    if (r.ok) {
      const d = await r.json();
      setProductos(d.productos);
      setUltimaSync(d.ultimaSync);
      setAsignSku(Object.fromEntries(d.productos.filter((p: GnProd) => p.skuLiso).map((p: GnProd) => [p.gnId, p.skuLiso])));
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch('/api/produccion/stock-terminado').then((r) => r.ok ? r.json() : []).then((rows: { sku: string }[]) => {
      setLisosSugeridos((prev) => [...new Set([...prev, ...rows.map((x) => x.sku)])]);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    setLisosSugeridos((prev) => [...new Set([...prev, ...productos.map((p) => p.skuLiso).filter(Boolean) as string[]])]);
  }, [productos]);

  const sincronizar = async () => {
    setSyncing(true); setSyncMsg('Sincronizando con Gestión Nube…');
    for (let i = 0; i < 80; i++) {
      const r = await fetch('/api/reposicion/sync-productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || 'Error al sincronizar'); break; }
      await cargar();
      if (d.done) { setSyncMsg(''); toast.success('Catálogo sincronizado'); break; }
      const totalPag = d.total ? Math.ceil(d.total / 50) : '?';
      setSyncMsg(`Sincronizando… página ${d.lastPage}/${totalPag}${d.error ? ' · la API de GN se saturó, reintentando' : ''}`);
      if (d.error) await new Promise((s) => setTimeout(s, 2500));
    }
    setSyncing(false);
  };

  const vincular = async (p: GnProd) => {
    const skuLiso = (asignSku[p.gnId] || '').trim();
    if (!skuLiso) { toast.error('Elegí el SKU del liso'); return; }
    const r = await fetch('/api/reposicion/mapeo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gnId: p.gnId, gnCode: p.code, gnNombre: p.name, skuLiso }) });
    if (r.ok) { setProductos((prev) => prev.map((x) => x.gnId === p.gnId ? { ...x, skuLiso: skuLiso.toUpperCase() } : x)); toast.success(`${p.name} → ${skuLiso.toUpperCase()}`); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'Error al vincular'); }
  };

  const desvincular = async (p: GnProd) => {
    const r = await fetch(`/api/reposicion/mapeo?gnId=${p.gnId}`, { method: 'DELETE' });
    if (r.ok) { setProductos((prev) => prev.map((x) => x.gnId === p.gnId ? { ...x, skuLiso: null } : x)); setAsignSku((s) => ({ ...s, [p.gnId]: '' })); }
    else toast.error('No se pudo desvincular');
  };

  const vinculados = productos.filter((p) => p.skuLiso).length;
  const f = norm(filtro.trim());
  const lista = productos.filter((p) => {
    if (soloSinVincular && p.skuLiso) return false;
    if (!f) return true;
    return norm(`${p.code ?? ''} ${p.name} ${p.provider}`).includes(f);
  });

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
      <datalist id="lisos-sug">{lisosSugeridos.map((s) => <option key={s} value={s} />)}</datalist>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={sincronizar} isLoading={syncing}>
          {productos.length === 0 ? 'Sincronizar productos' : 'Actualizar lista'}
        </Button>
        <span className="text-xs text-stone-400">
          {syncMsg || (ultimaSync ? `Última sync: ${new Date(ultimaSync).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Todavía no sincronizaste el catálogo')}
        </span>
        <span className="ml-auto text-xs text-stone-500">{vinculados}/{productos.length} vinculados</span>
      </div>

      {productos.length === 0 ? (
        <p className="text-sm text-stone-400">Apretá Sincronizar productos para traer tus artículos de Gestión Nube (Zattia/Areben/Stunned) y vincularlos.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <input type="text" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nombre / código / marca…" className={`${inp} flex-1`} />
            <label className="flex items-center gap-1.5 text-xs text-stone-500 whitespace-nowrap">
              <input type="checkbox" checked={soloSinVincular} onChange={(e) => setSoloSinVincular(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
              Solo sin vincular
            </label>
          </div>
          <div className="space-y-1.5 max-h-[32rem] overflow-y-auto">
            {lista.length === 0 ? <p className="text-xs text-stone-400 py-2">Sin resultados.</p> : lista.map((p) => (
              <div key={p.gnId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.skuLiso ? 'border-emerald-200 bg-emerald-50/40' : 'border-stone-100'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">{p.name}</p>
                  <p className="text-xs text-stone-400">{p.provider}{p.category ? ` · ${p.category}` : ''}</p>
                </div>
                <input type="text" list="lisos-sug" value={asignSku[p.gnId] || ''} placeholder="SKU liso"
                  onChange={(e) => setAsignSku((s) => ({ ...s, [p.gnId]: e.target.value.toUpperCase() }))} className={`${inp} font-mono w-44`} />
                <button onClick={() => vincular(p)} className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 font-semibold transition">{p.skuLiso ? 'Guardar' : 'Vincular'}</button>
                {p.skuLiso && <button onClick={() => desvincular(p)} title="Desvincular" className="text-stone-300 hover:text-red-500 px-1 leading-none text-lg">×</button>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
