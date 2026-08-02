import { redirect } from 'next/navigation';

// La pantalla se mudó a /muestras (sección propia): el permiso `muestras` no
// pasa por el layout de Producción. Se deja el redirect por los links viejos.
export default function MuestrasRedirect() {
  redirect('/muestras');
}
