import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase para el server, usado SOLO en el flujo de ingreso con
 * Google (la ruta /auth/callback). El resto de la app NO depende de Supabase:
 * una vez validada la identidad, producción emite su propia cookie de sesión
 * (`areben_session`, HMAC) y todo sigue leyendo esa, como siempre.
 *
 * Por eso la cookie de Supabase es efímera acá: se usa para canjear el code y
 * leer el email, nada más. No se persiste una sesión de Supabase de larga vida.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un contexto donde no se pueden setear cookies; se ignora.
          }
        },
      },
    }
  );
}
