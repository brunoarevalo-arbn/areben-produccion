'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [cargando,  setCargando]  = useState(false);
  const [sinUsers,  setSinUsers]  = useState<boolean | null>(null);

  // Bootstrap: new admin form
  const [setupNombre,   setSetupNombre]   = useState('');
  const [setupUser,     setSetupUser]     = useState('');
  const [setupPass,     setSetupPass]     = useState('');
  const [setupLoading,  setSetupLoading]  = useState(false);
  const [setupError,    setSetupError]    = useState('');

  const router = useRouter();

  useEffect(() => {
    fetch('/api/usuarios')
      .then(async (r) => {
        if (r.status === 403) {
          setSinUsers(false);
        } else if (r.ok) {
          const d = await r.json();
          setSinUsers(Array.isArray(d) && d.length === 0);
        } else {
          setSinUsers(false);
        }
      })
      .catch(() => setSinUsers(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setCargando(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al ingresar');
      } else {
        if (data.rol === 'costurera') {
          router.push('/tiempos');
        } else if (data.rol === 'admin') {
          router.push('/dashboard');
        } else {
          const primera = (data.permisos as string[] | undefined)?.[0];
          router.push(primera ? `/${primera}` : '/dashboard');
        }
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupNombre.trim() || !setupUser.trim() || !setupPass.trim()) return;
    setSetupLoading(true);
    setSetupError('');
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: setupNombre, username: setupUser, password: setupPass, rol: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || 'Error al crear usuario');
      } else {
        setSinUsers(false);
      }
    } catch {
      setSetupError('Error de conexión');
    } finally {
      setSetupLoading(false);
    }
  };

  // Loading state
  if (sinUsers === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-900">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
      </div>
    );
  }

  if (sinUsers) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-900">
        <div className="w-full max-w-sm px-8">
          <div className="mb-8 text-center">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">Areben</p>
            <h1 className="text-2xl font-bold text-white">Configuración inicial</h1>
            <p className="text-stone-400 text-sm mt-2">Creá el primer usuario administrador</p>
          </div>

          <form onSubmit={handleSetup} className="space-y-3">
            <input
              type="text"
              value={setupNombre}
              onChange={(e) => setSetupNombre(e.target.value)}
              placeholder="Nombre completo"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-600 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-amber-400"
            />
            <input
              type="text"
              value={setupUser}
              onChange={(e) => setSetupUser(e.target.value)}
              placeholder="Usuario (ej: admin)"
              autoCapitalize="none"
              className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-600 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-amber-400"
            />
            <input
              type="password"
              value={setupPass}
              onChange={(e) => setSetupPass(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-600 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-amber-400"
            />
            {setupError && <p className="text-red-400 text-sm text-center">{setupError}</p>}
            <button
              type="submit"
              disabled={setupLoading}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-stone-900 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all"
            >
              {setupLoading ? 'Creando...' : 'Crear administrador'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-stone-900">
      <div className="w-full max-w-sm px-8">
        <div className="mb-8 text-center">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">Areben</p>
          <h1 className="text-3xl font-bold text-white leading-tight">Bienvenido</h1>
          <div className="w-8 h-0.5 bg-amber-400 mx-auto mt-4" />
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            autoCapitalize="none"
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-600 text-white placeholder-stone-500 text-center text-lg focus:outline-none focus:border-amber-400"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-600 text-white placeholder-stone-500 text-center text-lg focus:outline-none focus:border-amber-400"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={cargando || !username.trim() || !password}
            className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-stone-700 disabled:text-stone-500 text-stone-900 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all"
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
