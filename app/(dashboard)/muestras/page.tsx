import { RetiroTelaClient } from '@/components/muestras/RetiroTelaClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function RetiroTelaPage() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <PageHeader
        title="Retiro de tela"
        subtitle="La tela que se saca de un rollo para hacer muestras. Se descuenta del rollo en el momento."
      />
      <RetiroTelaClient />
    </div>
  );
}
