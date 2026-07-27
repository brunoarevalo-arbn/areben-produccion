'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

const ERRORES_GOOGLE: Record<string, string> = {
  'sin-acceso':
    'Tu cuenta de Google es válida, pero no tiene acceso a este sistema. Pedile el alta a un administrador.',
  google: 'No se pudo completar el ingreso con Google. Probá de nuevo.',
  'sin-codigo': 'El ingreso con Google quedó a medias. Probá de nuevo.',
};

/**
 * Marca de que el ingreso en curso salió de un salto entre apps (`?sso=1`) y no
 * de un click. Sirve para una sola cosa: si el salto no prospera, la vuelta trae
 * `?error=` y ese error NO hay que mostrarlo — que falle es lo esperable cuando
 * el navegador no tiene sesión de Google, y no es culpa de nadie.
 */
const CLAVE_SALTO = 'areben-sso-salto';

export default function LoginPage() {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [aviso,     setAviso]     = useState('');
  const [cargando,  setCargando]  = useState(false);
  const [googleCargando, setGoogleCargando] = useState(false);
  const [saltando,  setSaltando]  = useState(false);
  const [sinUsers,  setSinUsers]  = useState<boolean | null>(null);
  const saltoIniciado = useRef(false);

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

  /**
   * Arranca el ingreso con Google. En modo `silencioso` suma `prompt=none`: si el
   * navegador ya tiene sesión de Google —el caso de quien viene de otra app de
   * Areben— Google responde sin mostrar ninguna pantalla y la vuelta es inmediata.
   * Si NO la tiene, contesta con un error en vez de pedir credenciales, y ahí
   * caemos al login de siempre.
   */
  const entrarConGoogle = async ({ silencioso = false } = {}) => {
    setError('');
    if (!silencioso) setGoogleCargando(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // La pantalla de consentimiento ya es Interna (solo cuentas de la
        // organización); `hd` evita que el selector ofrezca cuentas personales.
        queryParams: silencioso
          ? { hd: 'arebensrl.com', prompt: 'none' }
          : { hd: 'arebensrl.com' },
      },
    });
    if (error) {
      if (silencioso) {
        sessionStorage.removeItem(CLAVE_SALTO);
        setSaltando(false);
        setAviso('Entrá con Google para continuar.');
      } else {
        setError(ERRORES_GOOGLE.google);
        setGoogleCargando(false);
      }
    }
  };

  // Vuelta de /auth/callback (?error=sin-acceso|google|sin-codigo) y salto
  // silencioso desde otra app de Areben (?sso=1).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codigoError = params.get('error');

    if (codigoError) {
      const veniaDeSalto = sessionStorage.getItem(CLAVE_SALTO) === '1';
      sessionStorage.removeItem(CLAVE_SALTO);
      // `sin-acceso` sí se muestra aunque venga de un salto: ahí Google autenticó
      // bien y lo que falta es el alta en ESTE sistema. Es información útil.
      if (veniaDeSalto && codigoError !== 'sin-acceso') {
        setAviso('Entrá con Google para continuar.');
        return;
      }
      setError(ERRORES_GOOGLE[codigoError] ?? ERRORES_GOOGLE.google);
      return;
    }

    if (params.get('sso') !== '1') {
      sessionStorage.removeItem(CLAVE_SALTO); // visita normal al login: estado limpio
      return;
    }

    if (saltoIniciado.current) return; // en dev React corre los efectos dos veces
    saltoIniciado.current = true;
    sessionStorage.setItem(CLAVE_SALTO, '1');
    setSaltando(true);
    entrarConGoogle({ silencioso: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Salto desde otra app: se va a Google y vuelve, así que mostrar el formulario
  // sería un parpadeo inútil.
  if (saltando) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-900">
        <div className="text-center">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping mx-auto" />
          <p className="text-stone-400 text-sm mt-6">Entrando…</p>
        </div>
      </div>
    );
  }

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
          onClick={() => entrarConGoogle()}
          disabled={googleCargando}
          className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-stone-100 disabled:opacity-60 text-stone-800 py-3 rounded-xl font-semibold text-sm transition-all"
        >
          <LogoGoogle />
          {googleCargando ? 'Redirigiendo...' : 'Entrar con Google'}
        </button>
        <p className="text-center text-xs text-stone-500 mt-2">
          {aviso || (
            <>
              Si tenés mail <span className="text-stone-400">@arebensrl.com</span>, entrá con Google.
            </>
          )}
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
