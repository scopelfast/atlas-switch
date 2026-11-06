import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ControlIntegrationsManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Interruptores globais de integrações e notificações; segredos ficam no ficheiro de ambiente do servidor."
        backHref="/dashboard/control-integrations"
        backLabel="Voltar às integrações"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Resumo" wide>
          <p>
            Esta área expõe só <strong>liga / desliga</strong> para capacidades que dependem de fornecedores externos
            (OpenAI, Gemini, Microsoft Graph, Google Calendar, WhatsApp, etc.). Chaves e segredos <strong>nunca</strong>{' '}
            vão para a base de dados: ficam em variáveis de ambiente (ex. <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env</code>)
            no servidor; após alterar, é necessário reiniciar ou voltar a publicar a aplicação.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Papéis e permissões">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Acesso ao plano de controlo</strong> — apenas contas com papel global{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">platform_admin</code> (função{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">canAccessControlPlane</code> no código). O
              dono de um time (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">owner</code> no time) não
              herda estes interruptores só por isso.
            </li>
            <li>
              Utilizadores normais de um time <strong>não</strong> alteram estes toggles; continuam a usar opt-ins por
              equipa dentro de cada módulo (Taskflow, Reunify, etc.).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações com outros módulos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Chronos</strong> — leitura de calendário Microsoft / Google só quando o toggle respectivo está
              ativo <em>e</em> as variáveis OAuth estão corretas.
            </li>
            <li>
              <strong>Taskflow</strong> — chat/embeddings na nuvem e busca semântica respeitam os interruptores OpenAI
              / Gemini e chaves configuradas.
            </li>
            <li>
              <strong>Reunify</strong> — ASR em terceiros (ex. AssemblyAI) depende de chave em ambiente e política do
              cliente; ver manual Reunify e documentação LGPD.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial neste módulo">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Aqui define-se se a <strong>instância</strong> permite chamadas a APIs cloud; cada equipa ainda pode ter
              opt-in próprio nos módulos.
            </li>
            <li>
              Heurísticas puramente locais (sem envio a terceiros) não passam por estes interruptores da mesma forma;
              mesmo assim documente o processamento no memorial de produto.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Toggle ativo mas funcionalidade falha</strong> — verifique variáveis de ambiente, URLs de
              callback OAuth e relógio do servidor.
            </li>
            <li>
              <strong>Mudança sem efeito</strong> — confirme redeploy/restart após editar <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env</code>.
            </li>
            <li>
              <strong>SMTP / notificações</strong> — valide host, porta e credenciais antes de ativar resumos por
              e-mail.
            </li>
            <li>
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/help">
                Centro de ajuda
              </a>{' '}
              e{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/control-center">
                Control Center
              </a>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface lg:col-span-2">
          <CardHeader>
            <CardTitle>Boas práticas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>Mantenha o acesso a esta área restrito a quem gere a infraestrutura ou o produto.</li>
              <li>Após alterar o ficheiro de ambiente, faça redeploy ou reinicie o processo Node.</li>
              <li>Valide SMTP e cada conector num ambiente de staging antes de produção.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
