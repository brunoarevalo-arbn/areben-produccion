import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase en el navegador, usado sólo para arrancar el ingreso con
 * Google desde el login. Ver lib/supabase-server.ts para el resto del flujo.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
