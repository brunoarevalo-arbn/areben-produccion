'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Usuario {
  id: string;
  nombre: string;
  username: string;
  rol: string;
  activo: boolean;
  createdAt: string | Date;
}

const ROL_BADGE: Record<string, string> = {
  admin:     'bg-violet-100 text-violet-700',
  costurera: 'bg-amber-100 text-amber-700',
};

const ROL_LABEL: Record<string, string> = {
  admin:     'Administrador',
  costurera: 'Costurera',
};

export function UsuariosManager({ usuarios: inicial, sesionId }: { usuarios: Usuario[]; sesionId: string }) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState(inicial);
  const [showForm, setShowForm] = useState(false);

  // New user form
  const [nombre,   setNombre]   = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol,      setRol]      = useState<'admin' | 'costurera'>('costurera');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  // Edit state
  const [editId,       setEditId]       = useState<string | null>(null);
  const [editNombre,   setEditNombre]   = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRol,      setEditRol]      = useState<'admin' | 'costurera'>('admin');
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
        body: JSON.stringify({ nombre, username, password, rol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al crear usuario');
      } else {
        setUsuarios((prev) => [...prev, data]);
        setNombre(''); setUsername(''); setPassword(''); setRol('costurera');
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
    setEditPassword('');
    setEditRol(u.rol as 'admin' | 'costurera');
    setEditActivo(u.activo);
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    setEditError('');
    const body: Record<string, unknown> = { nombre: editNombre, rol: editRol, activo: editActivo };
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

  return (
    <div className="max-w-2xl space-y-6">
      {/* User list */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {usuarios.map((u, i) => (
          <div key={u.id} className={`px-5 py-4 flex items-center gap-4 ${i !== 0 ? 'border-t border-stone-100' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-sm shrink-0">
              {u.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-stone-900 text-sm">{u.nombre}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROL_BADGE[u.rol] ?? 'bg-stone-100 text-stone-500'}`}>
                  {ROL_LABEL[u.rol] ?? u.rol}
                </span>
                {!u.activo && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Inactivo</span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-0.5">@{u.username}</p>
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
          <h3 className="text-sm font-bold text-stone-800 mb-4">Nuevo usuario</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario (ej: maria)"
              autoCapitalize="none"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">Rol</label>
              <div className="flex gap-2">
                {(['costurera', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRol(r)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                      rol === r ? `${ROL_BADGE[r]} border-transparent` : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}
                  >
                    {ROL_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear usuario'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit user form */}
      {editId && (
        <div className="bg-white rounded-2xl border border-violet-200 p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-4">Editar usuario</h3>
          <form onSubmit={handleEdit} className="space-y-3">
            <input
              type="text"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
            <input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Nueva contraseña (dejar vacío para no cambiar)"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">Rol</label>
              <div className="flex gap-2">
                {(['costurera', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditRol(r)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                      editRol === r ? `${ROL_BADGE[r]} border-transparent` : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}
                  >
                    {ROL_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditActivo(!editActivo)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${editActivo ? 'bg-emerald-500' : 'bg-stone-300'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${editActivo ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-stone-600">{editActivo ? 'Activo' : 'Inactivo'}</span>
            </div>
            {editError && <p className="text-red-500 text-xs">{editError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={() => { setEditId(null); setEditError(''); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
