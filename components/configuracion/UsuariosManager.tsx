'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Usuario {
  id:       string;
  nombre:   string;
  username: string;
  rol:      string;
  permisos: string[];
  activo:   boolean;
  createdAt: string | Date;
}

const ROLES = [
  { value: 'costurera',  label: 'Costurera',   color: 'bg-amber-100 text-amber-700' },
  { value: 'diseñadora', label: 'Diseñadora',   color: 'bg-violet-100 text-violet-700' },
  { value: 'admin',      label: 'Administrador', color: 'bg-stone-100 text-stone-700' },
] as const;

const SECCIONES = [
  { id: 'dashboard',     label: 'Dashboard' },
  { id: 'diseno',        label: 'Diseño' },
  { id: 'produccion',    label: 'Producción' },
  { id: 'gastos',        label: 'Gastos' },
  { id: 'costos',        label: 'Costos' },
  { id: 'configuracion', label: 'Configuración' },
] as const;

function rolColor(rol: string) {
  return ROLES.find((r) => r.value === rol)?.color ?? 'bg-stone-100 text-stone-500';
}
function rolLabel(rol: string) {
  return ROLES.find((r) => r.value === rol)?.label ?? rol;
}

function PermisosToggle({
  rol,
  permisos,
  onChange,
}: {
  rol: string;
  permisos: string[];
  onChange: (p: string[]) => void;
}) {
  if (rol === 'admin') {
    return (
      <p className="text-xs text-stone-400 italic">El administrador tiene acceso completo.</p>
    );
  }
  if (rol === 'costurera') {
    return (
      <p className="text-xs text-stone-400 italic">Las costureras solo acceden a la pantalla de tiempos.</p>
    );
  }
  return (
    <div className="space-y-1.5">
      {SECCIONES.map(({ id, label }) => {
        const on = permisos.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() =>
              onChange(on ? permisos.filter((p) => p !== id) : [...permisos, id])
            }
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition ${
              on
                ? 'bg-violet-50 border-violet-300 text-violet-800'
                : 'bg-white border-stone-200 text-stone-400 hover:border-stone-300'
            }`}
          >
            <span className="font-medium">{label}</span>
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-xs ${on ? 'bg-violet-500 border-violet-500 text-white' : 'border-stone-300'}`}>
              {on && '✓'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-semibold text-stone-600">{label}</label>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function UsuariosManager({ usuarios: inicial, sesionId }: { usuarios: Usuario[]; sesionId: string }) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState(inicial);
  const [showForm, setShowForm] = useState(false);

  const [nombre,   setNombre]   = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol,      setRol]      = useState<string>('costurera');
  const [permisos, setPermisos] = useState<string[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const [editId,       setEditId]       = useState<string | null>(null);
  const [editNombre,   setEditNombre]   = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRol,      setEditRol]      = useState('admin');
  const [editPermisos, setEditPermisos] = useState<string[]>([]);
  const [editActivo,   setEditActivo]   = useState(true);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editError,    setEditError]    = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !username.trim() || !password.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, username, password, rol, permisos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al crear usuario');
      } else {
        setUsuarios((prev) => [...prev, data]);
        setNombre(''); setUsername(''); setPassword(''); setRol('costurera'); setPermisos([]);
        setShowForm(false);
        router.refresh();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: Usuario) => {
    setEditId(u.id);
    setEditNombre(u.nombre);
    setEditUsername(u.username);
    setEditPassword('');
    setEditRol(u.rol);
    setEditPermisos(u.permisos ?? []);
    setEditActivo(u.activo);
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    setEditError('');
    const body: Record<string, unknown> = {
      nombre:   editNombre,
      username: editUsername,
      rol:      editRol,
      permisos: editPermisos,
      activo:   editActivo,
    };
    if (editPassword.trim()) body.password = editPassword;
    try {
      const res = await fetch(`/api/usuarios/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Error al guardar');
      } else {
        setUsuarios((prev) => prev.map((u) => u.id === editId ? { ...u, ...data } : u));
        setEditId(null);
        router.refresh();
      }
    } catch {
      setEditError('Error de conexión');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsuarios((prev) => prev.filter((u) => u.id !== id));
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch {
      alert('Error de conexión');
    }
  };

  const inputClass = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400';

  return (
    <div className="max-w-2xl space-y-6">

      {/* User list */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_1fr_auto] gap-4">
          <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Nombre</span>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Usuario</span>
          <span />
        </div>

        {usuarios.map((u, i) => (
          <div
            key={u.id}
            className={`px-5 py-4 grid grid-cols-[1fr_1fr_auto] gap-4 items-center ${i !== 0 ? 'border-t border-stone-100' : ''} ${!u.activo ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-sm shrink-0">
                {u.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-stone-900 text-sm truncate">{u.nombre}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rolColor(u.rol)}`}>
                    {rolLabel(u.rol)}
                  </span>
                  {!u.activo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-500 font-semibold">Inactivo</span>
                  )}
                  {u.rol !== 'admin' && u.rol !== 'costurera' && u.permisos?.length > 0 && (
                    <span className="text-xs text-stone-400">{u.permisos.length} sección{u.permisos.length !== 1 ? 'es' : ''}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
                <span className="text-stone-400 text-xs font-mono">@</span>
                <span className="text-stone-700 text-sm font-mono font-semibold">{u.username}</span>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => openEdit(u)}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 transition"
              >
                Editar
              </button>
              {u.id !== sesionId && (
                <button
                  onClick={() => handleDelete(u.id, u.nombre)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50 transition"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}

        {usuarios.length === 0 && (
          <div className="px-5 py-10 text-center text-stone-400 text-sm">Sin usuarios</div>
        )}
      </div>

      {/* Add user button */}
      {!showForm && !editId && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
        >
          + Agregar usuario
        </button>
      )}

      {/* New user form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-5">Nuevo usuario</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Nombre completo">
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: María García" className={inputClass} />
            </Field>

            <Field label="Usuario de ingreso">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-mono">@</span>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="maria" autoCapitalize="none"
                  className={`${inputClass} pl-7 font-mono`} />
              </div>
            </Field>

            <Field label="Contraseña">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" className={inputClass} />
            </Field>

            <Field label="Rol">
              <div className="flex gap-2 flex-wrap">
                {ROLES.map((r) => (
                  <button key={r.value} type="button" onClick={() => { setRol(r.value); setPermisos([]); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                      rol === r.value ? `${r.color} border-transparent` : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Acceso a secciones">
              <PermisosToggle rol={rol} permisos={permisos} onChange={setPermisos} />
            </Field>

            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear usuario'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit user form */}
      {editId && (
        <div className="bg-white rounded-2xl border border-violet-200 p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-5">Editar usuario</h3>
          <form onSubmit={handleEdit} className="space-y-4">
            <Field label="Nombre completo">
              <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                placeholder="Nombre completo" className={inputClass} />
            </Field>

            <Field label="Usuario de ingreso">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-mono">@</span>
                <input type="text" value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  autoCapitalize="none"
                  className={`${inputClass} pl-7 font-mono`} />
              </div>
            </Field>

            <Field label="Nueva contraseña" hint="Dejar vacío para no cambiar">
              <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                placeholder="••••••••" className={inputClass} />
            </Field>

            <Field label="Rol">
              <div className="flex gap-2 flex-wrap">
                {ROLES.map((r) => (
                  <button key={r.value} type="button" onClick={() => { setEditRol(r.value); setEditPermisos([]); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                      editRol === r.value ? `${r.color} border-transparent` : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Acceso a secciones">
              <PermisosToggle rol={editRol} permisos={editPermisos} onChange={setEditPermisos} />
            </Field>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditActivo(!editActivo)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${editActivo ? 'bg-emerald-500' : 'bg-stone-300'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${editActivo ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-stone-600">{editActivo ? 'Activo' : 'Inactivo'}</span>
            </div>

            {editError && <p className="text-red-500 text-xs">{editError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={editSaving}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={() => { setEditId(null); setEditError(''); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
