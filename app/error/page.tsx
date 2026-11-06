import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ErrorPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Algo deu errado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <p>
              Não foi possível concluir a operação. Verifique os dados e tente novamente.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/pricing">Voltar para planos</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard">Ir para o painel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
