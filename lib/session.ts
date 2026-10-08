export const SESSION_COOKIE = 'areben_session';

// La cookie dura 7 días DESDE EL ÚLTIMO USO: `proxy.ts` la vuelve a poner en cada
// request con sesión. Antes vencía a los 7 días del login aunque se usara todo el
// día, y el 7-oct la tablet de Marisol se quedó sin sesión a media tarde: los
// guardados rebotaban al login y se perdió el tramo de 13:31 a 16:00.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   SESSION_MAX_AGE,
    secure:   process.env.NODE_ENV === 'production',
  };
}
// En producción exigimos SESSION_SECRET seteada: con el fallback hardcodeado se
// podrían forjar tokens (incluido admin). En dev usa un secreto local.
const SECRET = process.env.SESSION_SECRET
  ?? (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('SESSION_SECRET no está configurada en producción'); })()
    : 'areben-secret-local-dev-change-in-prod');

export interface SessionPayload {
  id: string;
  nombre: string;
  username: string;
  rol: 'admin' | 'costurera' | 'diseñadora' | 'estampador';
}

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromUrlSafe(safe: string): string {
  const b64 = safe.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  return pad ? b64 + '='.repeat(4 - pad) : b64;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const data = toUrlSafe(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  const key  = await getKey();
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = toUrlSafe(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return `${data}.${sigB64}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const data  = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const key  = await getKey();
    const sig  = Uint8Array.from(atob(fromUrlSafe(sigB64)), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    return JSON.parse(decodeURIComponent(escape(atob(fromUrlSafe(data))))) as SessionPayload;
  } catch {
    return null;
  }
}
