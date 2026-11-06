import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleHeader } from '@/components/ui/module-header';

export default function ActivityPageSkeleton() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <ModuleHeader
        title="Registro de atividades"
        description="Acompanhe tudo que acontece na conta."
      />
      <Card className="atlas-surface">
        <CardHeader>
          <CardTitle>Atividades recentes</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[88px]" />
      </Card>
    </section>
  );
}
