'use client';

import { useState, useEffect } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

interface Cortador {
  id: string;
  nombre: string;
  contacto: string | null;
  tarifaDefault: string | null;
  tarifaModo: string | null;
  notas: string | null;
  activo: boolean;
  usuarioId: string | null;
}
interface UsuarioOpt { id: string; nombre: string; username: string; permisos: string[]; activo: boolean }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

export function CortadoresManager({ initial }: { initial: Cortador[] }) {
  const [cortadores, setCortadores] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Cortador | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre]               = useState('');
  const [contacto, setContacto]           = useState('');
  const [tarifaDefault, setTarifaDefault] = useState('');
  const [tarifaModo, setTarifaModo]       = useState<'total' | 'unidad' | ''>('');
  const [notas, setNotas]                 = useState('');
  const [usuarioId, setUsuarioId]         = useState('');
  const [usuarios, setUsuarios]           = useState<UsuarioOpt[]>([]);

  useEffect(() => {
    fetch('/api/usuarios').then((r) => r.ok ? r.json() : []).then((us: UsuarioOpt[]) => setUsuarios(us.filter((u) => u.activo))).catch(() => {});
  }, []);

  const resetForm = () => {
    setNombre(''); setContacto(''); setTarifaDefault(''); setTarifaModo(''); setNotas(''); setUsuarioId(''); setError('');
  };

  const abrirNuevo = () => { resetForm(); setEditando(null); setShowForm(true); };
  const abrirEdicion = (c: Cortador) => {
    setNombre(c.nombre); setContacto(c.contacto || '');
    setTarifaDefault(c.tarifaDefault ? String(Number(c.tarifaDefault)) : '');
    setTarifaModo((c.tarifaModo as 'total' | 'unidad' | null) || '');
    setNotas(c.notas || ''); setUsuarioId(c.usuarioId || '');
    setEditando(c); setShowForm(true); setError('');
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Nombre obligatorio'); return; }
    setSaving(true); setError('');

    const payload = {
      nombre: nombre.trim(),
      contacto: contacto.trim() || undefined,
      tarifaDefault: tarifaDefault ? Number(tarifaDefault) : undefined,
      tarifaModo: tarifaModo || undefined,
      notas: notas.trim() || undefined,
      usuarioId: usuarioId || null,
    };

    const url = editando ? `/api/cortadores/${editando.id}` : '/api/cortadores';
    const method = editando ? 'PUT' : 'POST';

    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) {
      const item = await r.json();
      if (editando) setCortadores((prev) => prev.map((p) => p.id === item.id ? item : p));
      else setCortadores((prev) => [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setShowForm(false);
      resetForm();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleActivo = async (c: Cortador) => {
    const r = await fetch(`/api/cortadores/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !c.activo }),
    });
    if (r.ok) {
      const item = await r.json();
      setCortadores((prev) => prev.map((x) => x.id === item.id ? item : x));
    }
  };

  return (
    <div className="space-y-5">
      {!showForm && (
        <Button onClick={abrirNuevo}>
          + Agregar cortador
        </Button>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">{editando ? 'Editar cortador' : 'Nuevo cortador'}</h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre *" fullWidth type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Input label="Contacto" fullWidth type="text" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Tel / email" />
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Tarifa default</label>
                <NumInput value={parseFloat(tarifaDefault) || 0} onChange={(n) => setTarifaDefault(n ? String(n) : '')}
                  min="0" step="0.01" placeholder="Opcional" className={inp} />
              </div>
              <Select label="Modo de tarifa" fullWidth value={tarifaModo} onChange={(e) => setTarifaModo(e.target.value as 'total' | 'unidad' | '')}>
                <option value="">--</option>
                <option value="total">Total</option>
                <option value="unidad">Por unidad</option>
              </Select>
            </div>
            <Select label="Usuario del panel (login del cortador)" fullWidth value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
              <option value="">— Sin usuario (no accede al panel) —</option>
              {usuarios.filter((u) => u.permisos?.includes('cortador') || u.id === usuarioId).map((u) => (
                <option key={u.id} value={u.id}>{u.nombre} · {u.username}</option>
              ))}
            </Select>
            <p className="text-xs text-stone-400 -mt-2">Creá antes el usuario con permiso “Cortador (panel)” en Configuración → Usuarios, y pasale el link de acceso.</p>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} isLoading={saving}>
                {saving ? 'Guardando...' : editando ? 'Guardar' : 'Agregar'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span><span>Contacto</span><span>Tarifa</span><span>Modo</span><span>Estado</span><span />
        </div>
        {cortadores.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin cortadores</p>
        ) : (
          cortadores.map((c, i) => (
            <div key={c.id}
              className={`px-5 py-3.5 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!c.activo ? 'opacity-50' : ''}`}>
              <p className="text-sm font-medium text-stone-800">{c.nombre}</p>
              <span className="text-xs text-stone-500">{c.contacto || '--'}</span>
              <span className="text-xs text-stone-500 tabular-nums">{c.tarifaDefault ? `$${Number(c.tarifaDefault)}` : '--'}</span>
              <span className="text-xs text-stone-500">{c.tarifaModo || '--'}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {c.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => abrirEdicion(c)} className="px-2.5 py-1 rounded-lg">Editar</Button>
                <Button variant="secondary" size="sm" onClick={() => toggleActivo(c)} className="px-2.5 py-1 rounded-lg">{c.activo ? 'Desactivar' : 'Activar'}</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
