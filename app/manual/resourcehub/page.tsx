import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ResourceHubManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="ResourceHub — guia completo sem formação presencial: cadastro, alocações, números do painel e ligações reais a outros módulos."
        backHref="/dashboard/resourcehub"
        backLabel="Voltar ao ResourceHub"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Para que serve" wide>
          <p>
            O <strong>ResourceHub</strong> organiza a resposta à pergunta central de capacidade:{' '}
            <strong>
              Quem (ou o quê) está disponível, quantas horas por semana pode trabalhar e em que projetos ou tarefas
              essas horas estão comprometidas?
            </strong>{' '}
            Serve para inventário de <strong>pessoas</strong>, <strong>equipamentos</strong> ou <strong>espaços</strong>,
            para registrar <strong>custo/hora de referência</strong> (planejamento financeiro) e para ver se a equipe
            está <strong>abaixo ou acima da capacidade confortável</strong>, com base nas alocações que você criar.
          </p>
          <p>
            Não é calendário operacional (isso continua no <strong>Chronos</strong>) nem quadro de tarefas (isso é o{' '}
            <strong>Taskflow</strong>): aqui o foco é <em>capacidade planejada</em> por recurso e por período.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Quem pode acessar">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Quem tem a permissão <strong>ResourceHub — visualizar</strong> no perfil vê esta área e pode usar os
              formulários expostos na interface (cadastro e alocações), salvo restrições futuras do produto.
            </li>
            <li>
              Se aparecer a mensagem de acesso restrito, peça a um <strong>proprietário ou administrador</strong> do time
              que ajuste o catálogo de papéis em <strong>Catálogo</strong> ou equivalente.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Conceitos (leia antes de cadastrar)" wide>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Recurso</dt>
              <dd>
                Uma linha no inventário: nome, tipo (Pessoa / Equipamento / Espaço), estado (Disponível, Reservado,
                Manutenção), <strong>capacidade em horas por semana</strong> (ex.: 40 para tempo integral) e{' '}
                <strong>custo por hora</strong> em reais (opcional, para estimativas).
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Alocação</dt>
              <dd>
                Diz que um recurso fica com <strong>X horas por semana</strong> comprometidas entre uma{' '}
                <strong>data de início</strong> e uma <strong>data de fim</strong>, normalmente ligadas a um{' '}
                <strong>projeto do Projectus</strong>. Pode ainda referenciar uma <strong>tarefa do Taskflow</strong>{' '}
                pelo número identificador (opcional).
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Estado da alocação</dt>
              <dd>
                <strong>Ativo</strong> — entra na soma do heatmap. <strong>Pausado</strong> ou{' '}
                <strong>Encerrado</strong> — deixa de contar como carga útil no cálculo de utilização.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Utilização %</dt>
              <dd>
                Para cada recurso: soma das horas/semana de todas as alocações <strong>Ativas</strong>, dividida pela
                capacidade semanal do recurso, arredondada. Barras verdes/amarelas/vermelhas no painel seguem limiares
                aproximados (70% e 90%).
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Passo a passo — primeiro uso">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Confirme que existem <strong>projetos</strong> no Projectus se quiser ligar alocações a projetos com
              nome na lista.
            </li>
            <li>
              Em <strong>Novo recurso</strong>, crie pelo menos uma pessoa ou equipamento com capacidade realista
              (horas/semana).
            </li>
            <li>
              Em <strong>Nova alocação</strong>, escolha o recurso, o projeto (ou a opção sem projeto), datas de início e
              fim, horas por semana e estado. Guarde.
            </li>
            <li>
              Abra o <strong>Heatmap de capacidade</strong> e verifique se algum recurso passou do limiar confortável.
            </li>
            <li>
              Ajuste: criar uma nova alocação em estado Pausado não substitui a antiga — altere o estado ou crie alocações coerentes
              com a realidade (hoje a edição em massa pode passar por APIs ou evolução de UI).
            </li>
          </ol>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário Novo recurso — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Nome do recurso</dt>
              <dd>Obrigatório. Texto livre (ex.: Ana Silva, Sala B, Impressora 3). Sem nome não grava.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Tipo</dt>
              <dd>
                <strong>Pessoa</strong>, <strong>Equipamento</strong> ou <strong>Espaço</strong>. Serve para leitura e
                relatórios; não altera regras de negócio na primeira versão.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Status</dt>
              <dd>
                <strong>Disponível</strong> — pode receber alocações. <strong>Reservado</strong> — uso interno da
                equipe. <strong>Manutenção</strong> — indisponível; ajuste alocações em outros recursos se necessário.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Capacidade (h/sem)</dt>
              <dd>
                Número de horas por semana que este recurso pode dedicar (ex.: 40). O heatmap compara a soma das
                alocações <em>Ativas</em> com este valor.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Custo hora (R$)</dt>
              <dd>Opcional. Valor em reais por hora; o sistema guarda em centavos. Use para estimativas e confronto com
                custos reais fora do sistema (ex. BillTrak).</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Observações</dt>
              <dd>Opcional. Notas livres (contrato, turno, contato).</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Botão Criar recurso</dt>
              <dd>
                Envia os dados para o servidor e limpa nome, observações e custo no formulário. A lista à esquerda e o
                heatmap atualizam-se em seguida.
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário Nova alocação — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Recurso</dt>
              <dd>Obrigatório. Lista dos recursos já cadastrados no mesmo time.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Projeto</dt>
              <dd>
                Opcional na interface (opção genérica de projeto = sem projeto). Se escolher um nome, deve existir no{' '}
                <strong>Projectus</strong> do mesmo time.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Datas início e fim</dt>
              <dd>Obrigatórias. Definem o período em que as <strong>horas por semana</strong> aplicam. A lógica não
                fraciona por dia único dentro da semana — é plano semanal constante na janela.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Horas/sem</dt>
              <dd>Obrigatório (mínimo 1). Quantas horas deste recurso, por semana, ficam alocadas nesse intervalo. Várias
                alocações <strong>Ativas</strong> no mesmo recurso somam-se no heatmap.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Status</dt>
              <dd>
                <strong>Ativo</strong> — conta na utilização. <strong>Pausado</strong> / <strong>Encerrado</strong> —
                não somam no heatmap; use para fim de projeto ou liberar capacidade.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">ID da tarefa Taskflow (opcional)</dt>
              <dd>
                Se preencher, tem que ser o número inteiro da tarefa. O servidor rejeita IDs inexistentes ou invisíveis
                pelo seu papel. Não altera o Kanban.
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Botão Criar alocação</dt>
              <dd>
                Só ativo quando há recurso e ambas as datas. Se a API devolver erro (ex.: tarefa inválida), a mensagem
                aparece no topo do formulário.
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Painel — blocos da página" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Quatro cartões no topo</strong> — totais e utilização média; leia as descrições curtas sob cada
              título.
            </li>
            <li>
              <strong>Recursos monitorados</strong> — lista só leitura dos recursos com tipo, capacidade, custo/hora e
              estado.
            </li>
            <li>
              <strong>Alocações</strong> — lista de todas as alocações com recurso, projeto, datas, horas/semana e
              estado; mostra o rótulo Taskflow e o número da tarefa quando houver vínculo.
            </li>
            <li>
              <strong>Heatmap de capacidade</strong> — barra por recurso com percentagem (só alocações em estado Ativo); cores
              indicam zona de conforto (abaixo de 70%, 70–89%, 90%+).
            </li>
            <li>
              <strong>Ligações a outros módulos</strong> — resumo do que está integrado no código <em>hoje</em> vs o que
              deve ser feito manualmente ou em versões futuras.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações — o que é automático hoje">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Projectus</strong> — <em>Sim.</em> A lista de projetos na nova alocação vem da API do Projectus
              do mesmo time. O <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> fica
              gravado na alocação.
            </li>
            <li>
              <strong>Taskflow</strong> — <em>Parcial.</em> Pode preencher o ID numérico de uma tarefa; o servidor
              confirma que a tarefa existe e que o seu usuário tem permissão para vê-la. Isso{' '}
              <strong>não altera</strong> o estado do cartão no Kanban; apenas documenta a ligação na alocação.
            </li>
            <li>
              <strong>Chronos</strong> — <em>Não.</em> Não há leitura nem escrita de eventos do Chronos no cálculo de
              capacidade. Use o Chronos manualmente para bloqueios de tempo no dia a dia.
            </li>
            <li>
              <strong>BillTrak</strong> — <em>Não.</em> O custo/hora do recurso é informativo para si; não gera lançamentos
              no BillTrak.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial">
          <p>
            O ResourceHub <strong>não utiliza modelos de IA</strong> nesta versão. Sugestões futuras (previsão de
            sobrecarga, recomendação de realocação) dependerão de opt-in por equipe e de toggles globais descritos na{' '}
            <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/control-integrations">
              página de integrações
            </a>{' '}
            e na <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/ai-center">Central de IA</a>.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Lista de projetos vazia</strong> — crie projetos no Projectus ou confirme que está no time
              certo.
            </li>
            <li>
              <strong>Erro ao salvar alocação com ID de tarefa</strong> — o ID tem que ser inteiro positivo de uma
              tarefa existente; perfis com visão limitada no Taskflow só podem referenciar tarefas que já veem.
            </li>
            <li>
              <strong>Utilização a 0% com alocações visíveis</strong> — verifique se o estado da alocação é Ativo;
              outros estados não entram no somatório.
            </li>
            <li>
              <strong>Capacidade média no topo não bate com o esperado</strong> — é a média aritmética da utilização
              entre <em>todos</em> os recursos (incluindo os com 0%).
            </li>
            <li>
              <strong>API de competências</strong> — existe endpoint de competências para evolução do produto; a página
              principal ainda não expõe gestão de competências — ignore se não for programador.
            </li>
            <li>
              Dúvidas gerais: <a className="text-indigo-600 underline dark:text-indigo-400" href="/help">Centro de ajuda</a>.
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Cadastro e capacidade</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Cadastre recursos com tipo e estado coerentes com a operação real.</li>
              <li>Defina capacidade semanal igual ao contrato ou disponibilidade acordada (ex.: 40, 30, 0 em manutenção).</li>
              <li>Preencha custo/hora quando quiser comparar com orçamento ou BillTrak manualmente.</li>
              <li>Revise o heatmap após cada mudança relevante da equipe.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Alocação e revisão</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Crie alocações por janela de datas; use horas/semana consistentes com o contrato do recurso.</li>
              <li>Ligue ao projeto certo para rastreio executivo no Projectus.</li>
              <li>Use o ID da tarefa Taskflow apenas quando a entrega for a unidade de trabalho relevante.</li>
              <li>Semanalmente: pausar ou encerrar alocações que já não valem e criar novas para o próximo ciclo.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>Checklist semanal sugerido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Identificar recursos acima de 90% de utilização.</li>
              <li>Resolver sobreposição de projetos na mesma pessoa (negociação + ajuste de horas).</li>
              <li>Conferir se custo/hora ainda reflete a realidade (reajustar no recurso).</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
