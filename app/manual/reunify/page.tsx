import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ReunifyManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual do Reunify"
        description="Guia em português (Brasil) para usar o módulo sem treinamento presencial: cadastro de reuniões, pauta, decisões, ações, captação de áudio/vídeo, evidências de Zoom/Meet/Teams/Webex (ligação ou ficheiro) e integrações com Taskflow, Chronos e opções de equipe (rascunho / ASR)."
        backHref="/dashboard/reunify"
        backLabel="Voltar ao Reunify"
      />

      <div className="mt-6 space-y-4">
        <div id="visao-geral" className="scroll-mt-24" />
        <ManualDocBlock title="1. Para que serve o Reunify" wide>
          <p>
            O <strong>Reunify</strong> é o módulo de <strong>reuniões do time</strong> no AtlasSwitch. Ele serve para:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Cadastrar</strong> reuniões (data, horário, título, status, local, resumo) na base do sistema.
            </li>
            <li>
              <strong>Registrar pauta</strong> (tópicos com tempo e responsável), <strong>decisões</strong> e{' '}
              <strong>ações</strong> com prazo e responsável pela equipe.
            </li>
            <li>
              <strong>Guardar evidências</strong> de captação: link para gravação em outro serviço (Google Drive, Zoom
              na nuvem, etc.) ou <strong>envio de arquivo</strong> de áudio/vídeo, sujeito às políticas da sua empresa.
            </li>
            <li>
              <strong>Integrar com outros módulos</strong>: enviar uma ação para o <strong>Taskflow</strong> como
              tarefa; criar um compromisso no <strong>Chronos</strong>; opcionalmente usar <strong>rascunho a partir de
              texto</strong> e <strong>transcrição</strong> (AssemblyAI) se o gestor tiver ativado na equipe.
            </li>
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            O <strong>Projectus</strong> (portfólio de projetos) <strong>não liga</strong> automaticamente uma reunião a
            um projeto. Use o Projectus separadamente para acompanhamento executivo.
          </p>
        </ManualDocBlock>

        <div id="fluxo-na-tela" className="scroll-mt-24" />
        <ManualDocBlock title="2. Como a tela do dashboard está organizada" wide>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Cartões de resumo</strong> (topo): totais do <em>período</em> carregado (data base + modo dia /
              semana / lista) e, para ações, os números referem-se à <strong>reunião selecionada</strong>.
            </li>
            <li>
              <strong>Barra fixa «Reunião selecionada»</strong>: mostra qual reunião está ativa para pauta, decisões,
              ações e captação. O texto à direita lembra <strong>onde cada tipo de dado é gravado</strong>.
            </li>
            <li>
              <strong>Vista da agenda</strong> (Dia / Semana / Lista) + <strong>Data base</strong>: define o intervalo
              de datas consultado na API.
            </li>
            <li>
              <strong>Agenda de reuniões</strong> (coluna esquerda): lista as reuniões do intervalo. <strong>Clique</strong>{' '}
              numa linha para selecionar essa reunião.
            </li>
            <li>
              <strong>Registrar nova reunião</strong> (coluna direita): formulário que grava o cadastro via{' '}
              <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">POST /api/reunify/meetings</code>.
              Botão <strong>Salvar reunião</strong>.
            </li>
            <li>
              <strong>Gravação e arquivos da reunião</strong>: aparece quando há reunião selecionada. Aqui você
              registra <strong>link</strong> ou faz <strong>upload</strong> de arquivo; pode transcrever (AssemblyAI) se
              a equipe permitir.
            </li>
            <li>
              <strong>Pauta e decisões</strong> + <strong>Ações e follow-up</strong>: itens vinculados à reunião
              selecionada.
            </li>
            <li>
              <strong>Integrações com outros módulos</strong> (cartão no final): explica Taskflow, Chronos, rascunho/ASR
              e Projectus, com atalhos.
            </li>
          </ol>
        </ManualDocBlock>

        <div id="onde-grava" className="scroll-mt-24" />
        <ManualDocBlock title="3. Onde cada coisa é gravada (sem surpresas)">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Nova reunião</strong> → <code className="text-xs">POST /api/reunify/meetings</code> — linha na
              tabela de reuniões do <em>seu time</em>.
            </li>
            <li>
              <strong>Pauta</strong> → <code className="text-xs">POST /api/reunify/agenda-items</code> (com{' '}
              <code className="text-xs">meetingId</code>).
            </li>
            <li>
              <strong>Decisões</strong> → <code className="text-xs">POST /api/reunify/decisions</code>.
            </li>
            <li>
              <strong>Ações</strong> → <code className="text-xs">POST /api/reunify/action-items</code>.
            </li>
            <li>
              <strong>Link ou arquivo de captação</strong> →{' '}
              <code className="text-xs">POST /api/reunify/meetings/[id]/captures</code> (JSON com URL ou{' '}
              <code className="text-xs">multipart</code> com arquivo). O download do arquivo enviado usa o endpoint
              <code className="text-xs"> …/captures/[id]/file</code> na API.
            </li>
            <li>
              <strong>Criar tarefa no Taskflow a partir de uma ação</strong> →{' '}
              <code className="text-xs">POST /api/reunify/action-items/taskflow</code> (exige permissão de ver o
              Taskflow). A ação passa a exibir o vínculo.
            </li>
            <li>
              <strong>Criar compromisso no Chronos</strong> → <code className="text-xs">POST /api/chronos/agenda</code>{' '}
              com data/horário/título da reunião selecionada.
            </li>
          </ul>
        </ManualDocBlock>

        <div id="registrar-reuniao" className="scroll-mt-24" />
        <ManualDocBlock title="4. Registrar uma reunião (passo a passo)">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Confira a <strong>data base</strong> e o modo (Dia / Semana / Lista) se quiser ver a agenda nesse período.</li>
            <li>
              No cartão <strong>Registrar nova reunião</strong>, preencha pelo menos <strong>data da reunião</strong> e{' '}
              <strong>título</strong>.
            </li>
            <li>Ajuste horário de início e fim, <strong>status</strong> (agendada, em andamento, finalizada), local e resumo se quiser.</li>
            <li>Clique em <strong>Salvar reunião</strong>.</li>
            <li>
              A lista à esquerda deve atualizar; <strong>clique na reunião</strong> para selecioná-la e liberar as
              seções de pauta, ações e captação.
            </li>
          </ol>
        </ManualDocBlock>

        <div id="gravacao-arquivos" className="scroll-mt-24" />
        <ManualDocBlock title="5. Gravação, links e arquivos" wide>
          <p className="text-sm">
            Esta área <strong>não grava vídeo dentro do AtlasSwitch</strong> como se fosse Zoom: ela registra{' '}
            <strong>metadados</strong> de um <strong>link</strong> (HTTPS) ou armazena o <strong>arquivo</strong> que
            você enviar, conforme limites do servidor.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Link</strong>: cole a URL pública ou do seu drive e use <strong>Guardar ligação</strong> (o texto
              do botão na interface pode variar; a ação grava o registro de captação).
            </li>
            <li>
              <strong>Arquivo</strong>: escolha o arquivo no seu computador. Após o envio, pode aparecer opção de{' '}
              <strong>transcrever</strong> (AssemblyAI) se o gestor tiver habilitado — o áudio pode sair do seu
              ambiente para o fornecedor; leia a política da empresa.
            </li>
            <li>
              <strong>Exclusão</strong>: quem enviou ou um administrador pode remover o registro; isso apaga metadados e
              o arquivo no servidor quando aplicável.
            </li>
          </ul>
        </ManualDocBlock>

        <div id="pauta-acoes" className="scroll-mt-24" />
        <ManualDocBlock title="6. Pauta, decisões e ações">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Pauta</strong>: adicione tópicos com tempo estimado e dono do tópico. Ajuda a conduzir a reunião.
            </li>
            <li>
              <strong>Decisões</strong>: registre o que foi decidido, com responsável textual se fizer sentido.
            </li>
            <li>
              <strong>Ações</strong>: cada ação pode ter responsável (membro da equipe), prazo e notas. Status acompanha
              execução até concluir.
            </li>
            <li>
              <strong>Rascunho a partir de texto</strong> (opcional): com a opção ligada para o time, você cola texto
              (ata, transcrição) e o sistema sugere linhas como ações; <strong>marque as caixas</strong> e confirme
              antes de gravar — é revisão humana obrigatória.
            </li>
          </ul>
        </ManualDocBlock>

        <div id="integracoes" className="scroll-mt-24" />
        <div id="integracoes-plataformas" className="scroll-mt-24" />
        <ManualDocBlock title="7a. Plataformas de reunião online e APIs externas" wide>
          <p className="text-sm">
            No Brasil e em empresas, é comum usar <strong>Microsoft Teams</strong> (Office 365), <strong>Zoom</strong>,{' '}
            <strong>Google Meet</strong> (Workspace), <strong>Cisco Webex</strong> (quando a segurança é prioridade),
            <strong>Zoho Meeting</strong> ou ainda <strong>Skype</strong> em cenários legados. O Reunify{' '}
            <strong>não substitui</strong> essas ferramentas: elas continuam a ser o «sítio» da chamada e da gravação
            nativa da plataforma.
          </p>
          <p className="mt-2 text-sm">
            <strong>Como integrar com o AtlasSwitch hoje:</strong> cadastre a reunião no Reunify (data, hora, título)
            para pauta, decisões e acções no mesmo sítio que o resto do produto. Para o <em>áudio ou vídeo</em> da
            reunião feita no Zoom/Meet/Teams/Webex, use na aba <strong>Reunião</strong> a <strong>ligação https</strong>{' '}
            (link partilhável da gravação na nuvem do fornecedor ou ficheiro no Drive/OneDrive) ou{' '}
            <strong>envio de ficheiro</strong> / <strong>gravar no navegador</strong>. Não há, nesta versão da página,
            botão «Abrir Zoom» nem sincronização automática de calendário com essas marcas.
          </p>
          <p className="mt-2 text-sm">
            <strong>APIs externas envolvidas:</strong> apenas quando a equipe activa transcrição por{' '}
            <strong>AssemblyAI</strong> — o servidor envia o ficheiro de áudio ao fornecedor (ver documentação do
            projeto, DPA e chave <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">ASSEMBLYAI_API_KEY</code>
            ). Todas as outras operações de reunião (cadastro, pauta, acções, link de captação) usam as{' '}
            <strong>APIs REST do próprio AtlasSwitch</strong> sob <code className="text-xs">/api/reunify/…</code>.
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            <li>
              <strong>Escolha de plataforma</strong>: quem já está no Google Workspace tende ao Meet; quem está no
              Microsoft 365, ao Teams; Zoom continua forte em gravação e salas; Webex em contextos com requisitos
              elevados de segurança.
            </li>
            <li>
              <strong>Limitações típicas</strong>: planos gratuitos com tempo ou participantes limitados; qualidade
              depende da internet; políticas de dados e retenção de gravações são da plataforma escolhida.
            </li>
            <li>
              <strong>Privacidade</strong>: ao colar links ou subir áudio ao AtlasSwitch, as regras internas da empresa
              (e o contrato com AssemblyAI, se activo) aplicam-se em conjunto com as dos fornecedores de reunião.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="7b. Integrações AtlasSwitch (Taskflow, Chronos, ASR, Projectus)" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Taskflow</strong>: na lista de ações, use <strong>Criar no Taskflow</strong> para gerar uma
              tarefa no quadro. Se já existir vínculo, a API evita duplicar. Precisa de permissão para acessar o
              Taskflow.
            </li>
            <li>
              <strong>Chronos</strong>: no cartão «Integrações», o botão <strong>Criar no Chronos</strong> usa a reunião{' '}
              <strong>selecionada na barra fixa</strong> e cria um bloco na agenda (tipo reunião).
            </li>
            <li>
              <strong>Mensagem de impacto</strong>: após a ação, o sistema indica se a reunião foi sincronizada,
              já existia (idempotência) ou falhou. Em sucesso, use o atalho para abrir o Chronos na mesma data.
            </li>
            <li>
              <strong>Transcrição (AssemblyAI)</strong>: depende da configuração da equipe e de chaves no ambiente.
              Quando disponível, aparece na lista de captações após upload de áudio.
            </li>
            <li>
              <strong>Projectus</strong>: use para projetos, prazos e custos; não espere que o Reunify preencha projeto
              automaticamente.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Impacto entre módulos (regra comum)" wide>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Reunião continua sendo fonte de verdade no Reunify.</li>
            <li>Envio para Chronos cria/sincroniza compromisso, sem duplicar (idempotência).</li>
            <li>Ações podem virar tarefas no Taskflow mantendo rastreabilidade de origem.</li>
          </ul>
        </ManualDocBlock>

        <div id="permissoes" className="scroll-mt-24" />
        <ManualDocBlock title="8. Permissões (resumo)">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Ver e usar o Reunify exige permissão de <strong>visualização do módulo</strong> (papel definido pelo
              administrador).
            </li>
            <li>
              Ativar rascunho a partir de texto e fornecedor ASR costuma ser restrito a <strong>gestor / quem configura
              o quadro Taskflow</strong> da equipe — a interface desabilita se você não puder alterar.
            </li>
            <li>
              Exportar ação para o Taskflow exige permissão de <strong>ver o Taskflow</strong>.
            </li>
          </ul>
        </ManualDocBlock>

        <div id="problemas" className="scroll-mt-24" />
        <ManualDocBlock title="9. Problemas frequentes" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Não acho onde salvar a reunião</strong> → cartão à direita da agenda, título «Registrar nova
              reunião», botão <strong>Salvar reunião</strong>.
            </li>
            <li>
              <strong>Não aparece captação</strong> → selecione uma reunião na lista à esquerda; a seção desce na página.
            </li>
            <li>
              <strong>Botão Taskflow desabilitado</strong> → falta permissão de Taskflow ou a ação já está vinculada.
            </li>
            <li>
              <strong>Chronos não cria nada</strong> → confirme reunião selecionada e se você está autenticado; em caso
              de erro de API, peça suporte com horário e título da reunião.
            </li>
            <li>
              Mais ajuda institucional em{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/help">
                /help
              </a>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="atlas-surface" id="pop-preparacao">
            <CardHeader>
              <CardTitle>POP — Preparação</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Defina data base e cadastre a reunião com título e horário.</li>
                <li>Monte a pauta com tempos e responsáveis pelos tópicos.</li>
                <li>Avise a equipe e anexe link de captação ou material de apoio se existir.</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="atlas-surface" id="pop-execucao">
            <CardHeader>
              <CardTitle>POP — Execução</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Conduza pela pauta e atualize status dos tópicos.</li>
                <li>Registre decisões e ações ainda na reunião.</li>
                <li>Se usar arquivo de áudio, envie ao final ou conforme combinado.</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="atlas-surface lg:col-span-2" id="pop-followup">
            <CardHeader>
              <CardTitle>POP — Follow-up</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">
              <ul className="list-disc space-y-2 pl-5">
                <li>Converta ações críticas em tarefas no Taskflow.</li>
                <li>Crie compromisso de revisão no Chronos.</li>
                <li>Feche ações ou atualize prazos antes do próximo encontro.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
