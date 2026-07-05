'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface Cortador {
  id: string;
  nombre: string;
  contacto: string | null;
  notas: string | null;
  activo: boolean;
  usuarioId: string | null;
}
interface UsuarioOpt { id: string; nombre: string; username: string; permisos: string[]; activo: boolean }

export function CortadoresManager({ initial }: { initial: Cortador[] }) {
  const [cortadores, setCortadores] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Cortador | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre]               = useState('');
  const [contacto, setContacto]           = useState('');
  const [notas, setNotas]                 = useState('');
  const [usuarioId, setUsuarioId]         = useState('');
  const [usuarios, setUsuarios]           = useState<UsuarioOpt[]>([]);

  useEffect(() => {
    fetch('/api/usuarios').then((r) => r.ok ? r.json() : []).then((us: UsuarioOpt[]) => setUsuarios(us.filter((u) => u.activo))).catch(() => {});
  }, []);

  const resetForm = () => {
    setNombre(''); setContacto(''); setNotas(''); setUsuarioId(''); setError('');
  };

  const abrirNuevo = () => { resetForm(); setEditando(null); setShowForm(true); };
  const abrirEdicion = (c: Cortador) => {
    setNombre(c.nombre); setContacto(c.contacto || '');
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
        <Card padding="none" className="p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">{editando ? 'Editar cortador' : 'Nuevo cortador'}</h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre *" fullWidth type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Input label="Contacto" fullWidth type="text" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Tel / email" />
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
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span><span>Contacto</span><span>Estado</span><span />
        </div>
        {cortadores.length === 0 ? (
          <EmptyState message="Sin cortadores" />
        ) : (
          cortadores.map((c, i) => (
            <div key={c.id}
              className={`px-5 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!c.activo ? 'opacity-50' : ''}`}>
              <p className="text-sm font-medium text-stone-800">{c.nombre}</p>
              <span className="text-xs text-stone-500">{c.contacto || '--'}</span>
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
      </Card>
    </div>
  );
}
