import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function BillTrakManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="BillTrak — contas, lançamentos (contas a pagar/receber), transações e indicadores do painel; guia detalhado para uso sem formação presencial."
        backHref="/dashboard/billtrak"
        backLabel="Voltar ao BillTrak"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Para que serve" wide>
          <p>
            O <strong>BillTrak</strong> concentra o <strong>planeamento e o registo financeiro</strong> do time:{' '}
            <strong>lançamentos</strong> com vencimento e estado (pendente, pago, recebido, atrasado),{' '}
            <strong>categorias</strong>, <strong>ligação opcional a projetos</strong> do Projectus,{' '}
            <strong>contas</strong> (caixa, corrente, poupança) com saldo inicial em centavos, e{' '}
            <strong>transações</strong> (débito/crédito) para movimentar ou conciliar dinheiro. Os{' '}
            <strong>quatro cartões no topo</strong> do painel leem agregados da API de métricas sobre os lançamentos do
            mesmo time.
          </p>
          <p>
            Não substitui um ERP completo nem emite documentos fiscais: é <strong>controlo interno</strong>, leitura
            executiva e disciplina de vencimentos.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Quem pode aceder">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Quem tem a permissão <strong>BillTrak — visualizar</strong> vê o módulo e os formulários expostos na
              página.
            </li>
            <li>
              Se aparecer «Acesso restrito», peça a um <strong>administrador ou proprietário</strong> do time que
              inclua a função no perfil (ex.: via <strong>Catálogo</strong> de permissões).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Conceitos essenciais" wide>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Lançamento (conta a pagar / receber)</dt>
              <dd>
                Uma linha com <strong>título</strong>, <strong>valor em centavos</strong> na base de dados (na UI os
                formulários pedem «valor em centavos» — ex.: R$ 49,90 → <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">4990</code>
                ), <strong>data de vencimento</strong>, <strong>estado</strong>, categoria e projeto opcionais,
                recorrência opcional e notas.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Estados do lançamento</dt>
              <dd>
                <strong>Pendente</strong> — ainda não pago nem recebido. <strong>Pago</strong> — despesa liquidada
                (entra no agregado «Despesas pagas»). <strong>Recebido</strong> — receita confirmada (entra em «Receitas
                recebidas»). <strong>Atrasado</strong> — marcado manualmente quando quiser destacar atraso;{' '}
                <strong>não</strong> entra no somatório de «Pendências abertas» dos cartões (esse somatório é só estado
                «Pendente» na API atual).
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Transação</dt>
              <dd>
                Movimento de <strong>débito</strong> ou <strong>crédito</strong> com data, descrição, valor em centavos,
                opcionalmente ligado a uma <strong>conta</strong> e/ou a um <strong>lançamento</strong> existente. Serve
                para registar o que já passou na conta ou conciliar com extratos.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Conta financeira</dt>
              <dd>
                Registo de um meio (corrente, poupança, caixa) com <strong>nome</strong> e <strong>saldo inicial em
                centavos</strong>. As transações podem referenciar esta conta.
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Indicadores do painel (quatro cartões)">
          <p className="text-sm">
            Os valores vêm de <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/billtrak/metrics</code>
            , sempre filtrados ao <strong>mesmo time</strong> do utilizador.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Receitas recebidas</strong> — soma dos montantes dos lançamentos com estado{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">RECEBIDO</code>.
            </li>
            <li>
              <strong>Despesas pagas</strong> — soma com estado <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PAGO</code>.
            </li>
            <li>
              <strong>Pendências abertas</strong> — soma com estado{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PENDENTE</code> apenas.
            </li>
            <li>
              <strong>Margem indicativa</strong> —{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">(receitas − despesas) / receitas</code> em
              percentagem, arredondada; se não houver receitas recebidas, o painel mostra «—».
            </li>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O cartão «Como ler os indicadores» na própria página repete estes critérios.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário «Nova conta financeira» — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Nome da conta</dt>
              <dd>Obrigatório. Ex.: «Conta corrente PJ», «Caixa loja».</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Tipo</dt>
              <dd>
                <strong>Conta corrente</strong>, <strong>Poupança</strong> ou <strong>Caixa</strong> — classificação
                para relatórios; não altera regras automáticas na versão atual.
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Saldo em centavos</dt>
              <dd>
                Valor inteiro em <strong>centavos</strong> (não em reais). Ex.: saldo inicial R$ 1.000,00 →{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">100000</code>. Se deixar 0, a conta
                nasce com saldo zero.
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Criar conta</dt>
              <dd>Grava no servidor e atualiza a lista de contas disponível na seção de transações.</dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário «Novo lançamento» — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Título</dt>
              <dd>Obrigatório. Nome legível do compromisso (ex.: «Mensalidade software»).</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Valor em centavos</dt>
              <dd>Obrigatório. Mesma regra da conta: use centavos inteiros.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Data (vencimento)</dt>
              <dd>Obrigatório. Data de vencimento do lançamento.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Status</dt>
              <dd>
                Pendente, Pago, Recebido ou Atrasado — escolha o estado real; os cartões de métricas reagem conforme a
                tabela acima.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Categoria</dt>
              <dd>Opcional. Lista vinda das categorias do time.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Projeto (opcional)</dt>
              <dd>
                Lista do <strong>Projectus</strong> do mesmo time; grava <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> no lançamento para custo por projeto.
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Repetir automaticamente</dt>
              <dd>
                Se ativar, escolha <strong>Mensal</strong>, <strong>Trimestral</strong> ou <strong>Anual</strong>. A
                plataforma grava a regra no registo; não há job automático documentado aqui que crie o próximo
                lançamento sem acção sua — trate como lembrete de processo até haver evolução de produto.
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Observações</dt>
              <dd>Opcional. Texto livre (fornecedor, NF, centro de custo).</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Salvar lançamento</dt>
              <dd>
                Exige título, valor e data. Após gravar, a lista «Contas a pagar e receber» e os indicadores atualizam
                via SWR.
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário «Registrar transação» — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Descrição</dt>
              <dd>Obrigatório. Texto que identifica o movimento no extrato interno.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Valor em centavos</dt>
              <dd>Obrigatório.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Data</dt>
              <dd>Obrigatório. Data em que o movimento ocorreu.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Tipo</dt>
              <dd>
                <strong>Débito</strong> ou <strong>Crédito</strong> — sentido do movimento na contabilidade simplificada
                do módulo.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Conta (opcional)</dt>
              <dd>Associa a transação a uma das contas financeiras criadas.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Vincular lançamento (opcional)</dt>
              <dd>Liga a transação a um lançamento já existente, por exemplo após pagamento.</dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações — o que é automático hoje">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Projectus</strong> — <em>Sim.</em> A lista de projetos no novo lançamento vem da API do
              Projectus; o <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> fica gravado
              no lançamento.
            </li>
            <li>
              <strong>ResourceHub</strong> — <em>Não há sincronização automática</em> de custos ou alocações com o
              BillTrak nesta versão. Pode alinhar valores à mão entre módulos.
            </li>
            <li>
              <strong>Taskflow</strong> — <em>Não há</em> fluxo automático de aprovação financeira ligado ao BillTrak no
              código atual; use tarefas à parte se o processo o exigir.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial">
          <p className="text-sm">
            O BillTrak <strong>não utiliza IA</strong> nesta versão. Qualquer previsão de fluxo ou classificação
            automática seria evolução futura com opt-in e política de dados.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Valor errado após gravar</strong> — confirme se digitou <strong>centavos</strong> (ex.: 100000
              para mil reais, não 1000).
            </li>
            <li>
              <strong>Margem «—»</strong> — normal quando ainda não há lançamentos «Recebido»; a fórmula evita divisão
              por zero.
            </li>
            <li>
              <strong>Pendências no cartão não batem com o que vejo na lista</strong> — o cartão só soma estado{' '}
              <strong>Pendente</strong>; itens «Atrasado» ou outros estados não entram nesse total.
            </li>
            <li>
              <strong>Lista de projetos vazia</strong> — crie projetos no Projectus no mesmo time.
            </li>
            <li>
              Centro geral:{' '}
              <Link href="/help" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Ajuda
              </Link>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Organização diária</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Abra o BillTrak e ordene mentalmente por vencimento (a lista segue a data de vencimento).</li>
              <li>Confirme o que já pagou ou recebeu e atualize o estado do lançamento ou registre transação.</li>
              <li>Revise os quatro indicadores no topo após alterações.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Lançamentos e conciliação</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Crie lançamentos com categoria e projeto quando precisar de rastreio por obra ou área.</li>
              <li>Use transações para espelhar movimentos reais nas contas.</li>
              <li>Marque «Atrasado» quando quiser destacar cobrança ou pagamento em atraso (gestão visual).</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Recorrências e revisão</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>Para contas fixas, ative recorrência e escolha o período; confirme na operação se o próximo período
                foi criado ou crie manualmente até haver automatismo.</li>
              <li>Semanalmente, reconcilie transações com extrato bancário externo.</li>
              <li>Mensalmente, valide margem e pendências com a equipa de gestão.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
