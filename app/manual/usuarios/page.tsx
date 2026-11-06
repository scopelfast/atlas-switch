import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualHeader } from '@/components/ui/manual-header';

export default function UsuariosManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Gestão de membros, convites e permissões do time."
        backHref="/dashboard/usuarios"
        backLabel="Voltar para Usuários"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="atlas-surface lg:col-span-2">
          <CardHeader>
            <CardTitle>Checklist QA — convites ponta-a-ponta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Execute em ambiente de teste (ex.: local com <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">BASE_URL</code>{' '}
              igual ao URL do browser). No repositório pode correr também{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">pnpm check:invite-invariants</code> para
              invariantes de URL e token (não substitui estes passos no browser).
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">BASE_URL</code> no ambiente = URL onde a
                aplicação abre (ex.: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">http://localhost:3003</code>
                ).
              </li>
              <li>
                Convidar um e-mail novo; sem SMTP configurado, deve aparecer aviso e o link para compartilhar — não mensagem
                de sucesso falso de e-mail.
              </li>
              <li>Abrir o link; registar com o mesmo e-mail do convite; deve entrar no painel.</li>
              <li>Registar de novo com o mesmo link: deve falhar (convite já utilizado).</li>
              <li>Tentar registar com outro e-mail no mesmo link: deve falhar com mensagem sobre o e-mail do convite.</li>
              <li>
                «Reenviar convite» para e-mail ainda pendente: recebe e-mail ou vê link conforme SMTP; sem SMTP, o link
                deve aparecer para copiar.
              </li>
            </ol>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quando todos os passos estiverem verificados, registre data e resultado no memorial interno de execução do
              produto (secção «Registo de alterações»).
            </p>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Convidar membros</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Informe o e-mail e o nome do convidado.</li>
              <li>Escolha a função no time (conforme a sua permissão: membro, supervisor, gestor ou administrador).</li>
              <li>Envie o convite; se for membro ou supervisor, indique a quem reporta.</li>
              <li>Partilhe o link se o e-mail não for entregue (SMTP em falta).</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Remover acesso</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Localize o membro na lista.</li>
              <li>Clique em <strong>Remover</strong> e confirme.</li>
              <li>Registre a mudança com o time.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Boas práticas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc pl-5 space-y-2">
              <li>Conceda acesso mínimo necessário.</li>
              <li>Revise permissões em cada semestre.</li>
              <li>Mantenha a lista de membros atualizada.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
