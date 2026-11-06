import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ZapierMakeManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Ligar Taskflow a Zapier ou Make usando webhooks outbound."
        backHref="/dashboard/taskflow"
        backLabel="Voltar ao Taskflow"
      />

      <div className="mt-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              O Atlas envia eventos <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">task.created</code> e{' '}
              <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">task.updated</code> por{' '}
              <strong>POST HTTPS</strong> para a URL que configurar no Taskflow. No Zapier ou Make, use um módulo de
              captura de webhook e cole essa URL no Atlas.
            </p>
            <p>
              Documentação técnica no repositório:{' '}
              <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">Projeto/E8.14-zapier-make-taskflow.md</code>{' '}
              (formato, limites e URL assinada).
            </p>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Passos sugeridos</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Crie um <strong>Catch Hook</strong> (Zapier) ou <strong>Webhook personalizado</strong> (Make).</li>
              <li>No Taskflow, em <strong>Webhooks outbound</strong>, adicione a URL com <code className="text-xs">https://</code>.</li>
              <li>Opcional: defina um segredo para validar o cabeçalho <code className="text-xs">X-Atlas-Webhook-Signature</code> (HMAC-SHA256 do corpo).</li>
              <li>
                Para mapear campos antes do primeiro evento: no Taskflow use <strong>Gerar URL de exemplo</strong> e faça um{' '}
                <strong>GET</strong> a essa URL (válida 24 horas) a partir do seu cenário Make ou de um script interno.
              </li>
              <li>Máximo de <strong>cinco</strong> URLs por equipa.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Boas práticas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5">
              <li>Não publique a URL assinada de exemplo em sites abertos.</li>
              <li>Em produção, coloque o proxy (nginx, etc.) a enviar <code className="text-xs">X-Forwarded-For</code> correto para rate limits.</li>
              <li>Trate erros e repetições no Zapier/Make — o Atlas deduplica por webhook, mas o destino deve ser idempotente quando possível.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
