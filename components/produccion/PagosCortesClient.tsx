'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

interface OrdenCorte {
  id: string;
  sku: string;
  cantidad: number;
  cortador: string | null;
  cortadorId: string | null;
  costoCorte: string;
  pagoCorteId: string | null;
  createdAt: string;
  estado: string;
  pagoCorte: { id: string; fecha: string; beneficiario: string; montoTotal: string } | null;
  transiciones: { fecha: string }[];
}

interface Muestra {
  id: string; descripcion: string; valor: string; estado: string; pagoCorteId: string | null;
  fecha: string; cortadorId: string; cortador: { nombre: string } | null; consumo: string; unidad: string;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function PagosCortesClient({ saldos }: { saldos: { id: string; nombre: string; saldo: number }[] }) {
  const [ordenes, setOrdenes]   = useState<OrdenCorte[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState<'pendiente' | 'pagado' | 'todos'>('pendiente');
  const [filtroCortador, setFiltroCortador] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [muestras, setMuestras]   = useState<Muestra[]>([]);
  const [selMuestras, setSelMuestras] = useState<Set<string>>(new Set());

  // Form de pago
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha]       = useState(new Date().toISOString().slice(0, 10));
  const [beneficiario, setBeneficiario] = useState('');
  // El monto es del pago, no de lo tildado: tildar cortes es trazabilidad y no crea plata.
  const [monto, setMonto] = useState(0);
  const [notas, setNotas]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtro !== 'todos') params.set('pago', filtro);
    if (filtroCortador) params.set('cortador', filtroCortador);
    const mp = new URLSearchParams();
    if (filtro !== 'todos') mp.set('pago', filtro);
    const [r, rm] = await Promise.all([
      fetch(`/api/produccion/pagos-cortes?${params}`),
      fetch(`/api/produccion/cortes-muestra?${mp}`),
    ]);
    if (r.ok) setOrdenes(await r.json());
    if (rm.ok) setMuestras(await rm.json());
    setLoading(false);
  }, [filtro, filtroCortador]);

  // Solo se pueden pagar muestras validadas y sin pago; filtradas por cortador si aplica.
  const muestrasVista = muestras.filter((m) => !filtroCortador || m.cortador?.nombre === filtroCortador);
  const validar = async (id: string, estado: 'validado' | 'pendiente') => {
    const r = await fetch(`/api/produccion/cortes-muestra/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
    if (r.ok) setMuestras((prev) => prev.map((m) => m.id === id ? { ...m, estado } : m));
  };
  const toggleMuestra = (id: string) => setSelMuestras((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  useEffect(() => { cargar(); }, [cargar]);

  const cortadores = [...new Set([...ordenes.map((o) => o.cortador), ...muestras.map((m) => m.cortador?.nombre ?? null)].filter(Boolean) as string[])].sort();
  const muestraPend = (c: string) => muestras.filter((m) => m.cortador?.nombre === c && m.estado === 'validado' && !m.pagoCorteId);

  const toggleSel = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pendientes = ordenes.filter((o) => !o.pagoCorteId);
    if (seleccion.size === pendientes.length) {
      setSeleccion(new Set());
    } else {
      setSeleccion(new Set(pendientes.map((o) => o.id)));
    }
  };

  const seleccionadas = ordenes.filter((o) => seleccion.has(o.id));
  const muestrasSel = muestrasVista.filter((m) => selMuestras.has(m.id));
  const totalSeleccionado = seleccionadas.reduce((s, o) => s + Number(o.costoCorte), 0) + muestrasSel.reduce((s, m) => s + Number(m.valor), 0);

  // Sugerir beneficiario del cortador de lo seleccionado si es un solo cortador.
  const cortadoresUnicos = [...new Set([...seleccionadas.map((o) => o.cortador), ...muestrasSel.map((m) => m.cortador?.nombre ?? null)].filter(Boolean))];

  // Un pago es de UN cortador: la selección no puede cruzar dos, o la plata se atribuiría
  // a una cuenta y la traza a otra.
  const idsCortadorSel = [...new Set([...seleccionadas.map((o) => o.cortadorId), ...muestrasSel.map((m) => m.cortadorId)].filter(Boolean) as string[])];

  const abrirPago = () => {
    if (seleccion.size + selMuestras.size === 0) return;
    if (idsCortadorSel.length > 1) { setError('La selección mezcla cortadores: registrá un pago por cortador'); return; }
    if (cortadoresUnicos.length === 1) setBeneficiario(cortadoresUnicos[0]!);
    setMonto(Math.round(totalSeleccionado));
    setShowForm(true);
    setError('');
  };

  const registrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiario.trim()) { setError('Beneficiario obligatorio'); return; }
    if (!fecha) { setError('Fecha obligatoria'); return; }
    if (idsCortadorSel.length !== 1) { setError('Elegí cortes de un solo cortador'); return; }
    if (monto <= 0) { setError('El monto tiene que ser mayor a 0'); return; }

    setSaving(true);
    setError('');
    const r = await fetch('/api/produccion/pagos-cortes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha,
        beneficiario: beneficiario.trim(),
        cortadorId: idsCortadorSel[0],
        monto,
        ordenIds: [...seleccion],
        muestraIds: [...selMuestras],
        notas: notas || undefined,
      }),
    });

    if (r.ok) {
      setShowForm(false);
      setSeleccion(new Set());
      setSelMuestras(new Set());
      setBeneficiario('');
      setNotas('');
      cargar();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al registrar pago');
    }
    setSaving(false);
  };

  const totalPendiente = ordenes.filter((o) => !o.pagoCorteId).reduce((s, o) => s + Number(o.costoCorte), 0)
    + muestras.filter((m) => m.estado === 'validado' && !m.pagoCorteId).reduce((s, m) => s + Number(m.valor), 0);

  return (
    <div className="space-y-5">
      {/* Stats por cortador */}
      {filtro === 'pendiente' && cortadores.length > 0 && (
        <Card padding="none" className="p-4">
          {/* El número grande es EL SALDO de la cuenta corriente, el mismo que muestran
              /produccion/cuenta-cortadores y el panel del cortador. Antes acá vivía otro
              número con nombre parecido —lo pendiente por ítems, sin restar los pagos— y
              tener dos "pendientes" distintos es lo que hacía ilegible la cuenta. */}
          <div className="flex items-baseline justify-between mb-2 gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Saldo por cortador</p>
            <Link href="/produccion/cuenta-cortadores" className="text-xs text-amber-700 hover:underline shrink-0">Ver la cuenta corriente →</Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {saldos.map((s) => {
              const cortes = ordenes.filter((o) => o.cortadorId === s.id && !o.pagoCorteId);
              const ms = muestras.filter((m) => m.cortadorId === s.id && m.estado === 'validado' && !m.pagoCorteId);
              return (
                <div key={s.id} className="bg-stone-50 rounded-xl px-3 py-2 text-sm border border-stone-100">
                  <p className="text-xs text-stone-500">{s.nombre}</p>
                  <p className={`font-bold tabular-nums ${s.saldo < 0 ? 'text-emerald-600' : 'text-stone-900'}`}>${fmt(Math.abs(s.saldo))}{s.saldo < 0 ? ' a favor' : ''}</p>
                  <p className="text-xs text-stone-400">{cortes.length + ms.length} ítem(s) sin imputar</p>
                </div>
              );
            })}
            <div className="bg-stone-900 text-white rounded-xl px-3 py-2 text-sm ml-auto">
              <p className="text-xs opacity-70">Se debe en total</p>
              <p className="font-bold tabular-nums text-lg">${fmt(saldos.reduce((t, s) => t + Math.max(0, s.saldo), 0))}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['pendiente', 'pagado', 'todos'] as const).map((f) => (
          <Button key={f} variant={filtro === f ? 'primary' : 'secondary'} size="md"
            onClick={() => { setFiltro(f); setSeleccion(new Set()); }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
        <select value={filtroCortador} onChange={(e) => setFiltroCortador(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
          <option value="">Todos los cortadores</option>
          {cortadores.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {seleccion.size + selMuestras.size > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-stone-600">
              {seleccion.size + selMuestras.size} seleccionado(s) · <strong>${fmt(totalSeleccionado)}</strong>
            </span>
            <Button variant="primary" size="md" onClick={abrirPago}>Registrar pago</Button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto"><div className="min-w-[760px]">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400 items-center">
          <input type="checkbox"
            checked={filtro === 'pendiente' && seleccion.size > 0 && seleccion.size === ordenes.filter((o) => !o.pagoCorteId).length}
            onChange={toggleAll}
            disabled={filtro !== 'pendiente'}
            className="rounded border-stone-300" />
          <span>SKU</span>
          <span>Cortador</span>
          <span>Pago</span>
          <span className="text-right">Unid.</span>
          <span className="text-right">Costo corte</span>
          <span>Fecha</span>
          <span />
        </div>

        {loading ? (
          <LoadingState />
        ) : ordenes.length === 0 ? (
          <EmptyState message="Sin cortes" />
        ) : (
          ordenes.map((o, i) => {
            const fechaCorte = o.transiciones[0]?.fecha;
            const pagado = !!o.pagoCorteId;
            return (
              <div key={o.id}
                className={`px-5 py-3 grid grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto] gap-4 items-center text-sm ${i > 0 ? 'border-t border-stone-100' : ''} ${pagado ? 'opacity-60' : ''}`}>
                <input type="checkbox"
                  checked={seleccion.has(o.id)}
                  onChange={() => toggleSel(o.id)}
                  disabled={pagado}
                  className="rounded border-stone-300" />
                <Link href={`/produccion/${o.id}`}
                  className="font-mono font-bold text-xs bg-stone-100 px-2 py-1 rounded-lg text-stone-700 hover:text-amber-600 transition">
                  {o.sku}
                </Link>
                <span className="text-stone-700 truncate">{o.cortador || '--'}</span>
                <span className="text-xs">
                  {pagado ? (
                    <Badge variant="success" size="sm">Pagado {o.pagoCorte && fechaCorta(o.pagoCorte.fecha)}</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">Pendiente</Badge>
                  )}
                </span>
                <span className="text-stone-600 tabular-nums text-right">{o.cantidad}</span>
                <span className="text-stone-900 font-bold tabular-nums text-right">${fmt(o.costoCorte)}</span>
                <span className="text-stone-400 text-xs">{fechaCorte ? fechaCorta(fechaCorte) : '--'}</span>
                <Link href={`/produccion/${o.id}`} className="text-xs text-stone-500 hover:text-stone-800">Ver</Link>
              </div>
            );
          })
        )}
        </div></div>
      </Card>

      {/* Muestras del cortador */}
      {muestrasVista.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 text-xs font-bold uppercase tracking-widest text-stone-400">Muestras de cortadores</div>
          {muestrasVista.map((m, i) => {
            const pagada = !!m.pagoCorteId;
            const validada = m.estado === 'validado';
            return (
              <div key={m.id} className={`px-5 py-3 flex items-center gap-3 text-sm ${i > 0 ? 'border-t border-stone-100' : ''} ${pagada ? 'opacity-60' : ''}`}>
                {!pagada && validada
                  ? <input type="checkbox" checked={selMuestras.has(m.id)} onChange={() => toggleMuestra(m.id)} className="rounded border-stone-300" />
                  : <span className="w-4" />}
                <div className="flex-1 min-w-0">
                  <p className="text-stone-800 truncate">{m.descripcion}</p>
                  <p className="text-xs text-stone-400">{m.cortador?.nombre ?? '--'} · {Number(m.consumo)} {m.unidad} · {fechaCorta(m.fecha)}</p>
                </div>
                {pagada
                  ? <Badge variant="success" size="sm">Pagada</Badge>
                  : validada
                    ? <button onClick={() => validar(m.id, 'pendiente')} className="text-xs text-stone-400 hover:text-stone-600">✓ validada</button>
                    : <Button variant="secondary" size="sm" onClick={() => validar(m.id, 'validado')}>Validar</Button>}
                <span className="text-stone-900 font-bold tabular-nums w-24 text-right">${fmt(m.valor)}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* Modal de pago */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-1">Registrar pago de cortes</h3>
            <p className="text-xs text-stone-500 mb-4">
              {seleccion.size} corte(s){selMuestras.size > 0 ? ` + ${selMuestras.size} muestra(s)` : ''} · Total <strong>${fmt(totalSeleccionado)}</strong>
            </p>
            <form onSubmit={registrarPago} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Fecha *</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inp} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Beneficiario *</label>
                  <input type="text" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} required
                    placeholder="A quien se le paga" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Monto pagado *</label>
                  <input type="number" value={monto || ''} onChange={(e) => setMonto(Number(e.target.value) || 0)} required
                    min={1} className={inp} />
                  {monto !== Math.round(totalSeleccionado) && (
                    <p className="text-xs text-amber-700 mt-1">Imputás ${fmt(totalSeleccionado)} de ${fmt(monto)} pagados.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
                  placeholder="Comprobante, referencia, etc." className={`${inp} resize-none`} />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" size="lg" isLoading={saving} className="flex-1">
                  {saving ? 'Registrando...' : `Registrar pago de $${fmt(monto)}`}
                </Button>
                <Button type="button" variant="secondary" size="lg" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
