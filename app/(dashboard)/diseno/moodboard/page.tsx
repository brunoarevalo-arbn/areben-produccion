import { PageHeader } from '@/components/ui/PageHeader';
import { MoodboardClient } from '@/components/diseno/MoodboardClient';

export const dynamic = 'force-dynamic';

export default function MoodboardPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Diseño" title="Moodboard" subtitle="Ideas sueltas con fotos. Cuando maduran, se convierten en proyecto." />
      <MoodboardClient />
    </div>
  );
}
