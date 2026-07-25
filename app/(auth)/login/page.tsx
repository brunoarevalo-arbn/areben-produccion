'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

const ERRORES_GOOGLE: Record<string, string> = {
  'sin-acceso':
    'Tu cuenta de Google es válida, pero no tiene acceso a este sistema. Pedile el alta a un administrador.',
  google: 'No se pudo completar el ingreso con Google. Probá de nuevo.',
  'sin-codigo': 'El ingreso con Google quedó a medias. Probá de nuevo.',
};

export default function LoginPage() {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [cargando,  setCargando]  = useState(false);
  const [googleCargando, setGoogleCargando] = useState(false);
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

  // Mensaje de error con el que vuelve /auth/callback cuando el ingreso con
  // Google no prospera (?error=sin-acceso|google|sin-codigo).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(ERRORES_GOOGLE[code] ?? ERRORES_GOOGLE.google);
  }, []);

  const handleGoogle = async () => {
    setError('');
    setGoogleCargando(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // La pantalla de consentimiento ya es Interna (solo cuentas de la
        // organización); `hd` evita que el selector ofrezca cuentas personales.
        queryParams: { hd: 'arebensrl.com' },
      },
    });
    if (error) {
      setError(ERRORES_GOOGLE.google);
      setGoogleCargando(false);
    }
  };

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
        const permisos: string[] = data.permisos ?? [];
        if (data.rol === 'costurera') {
          router.push('/tiempos');
        } else if (data.rol !== 'admin' && permisos.includes('cortador') && !permisos.includes('dashboard')) {
          router.push('/cortador'); // cortador → directo a su panel
        } else {
          router.push('/dashboard');
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

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleCargando}
          className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-stone-100 disabled:opacity-60 text-stone-800 py-3 rounded-xl font-semibold text-sm transition-all"
        >
          <LogoGoogle />
          {googleCargando ? 'Redirigiendo...' : 'Entrar con Google'}
        </button>
        <p className="text-center text-xs text-stone-500 mt-2">
          Si tenés mail <span className="text-stone-400">@arebensrl.com</span>, entrá con Google.
        </p>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-stone-700" />
          <span className="text-[11px] text-stone-600 uppercase tracking-wider">o con usuario</span>
          <div className="flex-1 h-px bg-stone-700" />
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

function LogoGoogle() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z" />
    </svg>
  );
}
