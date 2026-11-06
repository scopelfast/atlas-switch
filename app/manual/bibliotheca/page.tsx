import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function BibliothecaManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Bibliotheca — catálogo de documentos do time, upload até 15 MB, metadados e vínculo opcional ao Projectus; guia para uso sem treinamento presencial."
        backHref="/dashboard/bibliotheca"
        backLabel="Voltar à Bibliotheca"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Para que serve" wide>
          <p>
            O <strong>Bibliotheca</strong> é o <strong>repositório de documentos do time</strong>: cada registro tem
            título, categoria, tamanho (texto descritivo), status (Ativo, Revisar, Arquivado), visibilidade (Equipe ou
            Gestão), tags e descrição opcionais, URL e tipo de arquivo opcionais, e <strong>vínculo opcional a um projeto
            do módulo Projectus</strong> (portfólio do mesmo time).
          </p>
          <p>
            A página lista documentos recentes (limite padrão de <strong>20</strong> por pedido à API), permite filtrar
            por categoria, status e projeto Projectus, e inclui formulário para <strong>criar</strong> registro novo,
            com <strong>upload</strong> opcional para a pasta pública do servidor (até 15 MB) ou preenchimento manual de
            URL. Não substitui armazenamento empresarial externo (S3, SharePoint): guarda arquivos sob{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">public/bibliotheca/</code> nesta versão.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Quem pode acessar">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Usuários com permissão <strong>Bibliotheca — visualizar</strong> (
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">bibliotheca.view</code>) veem lista, filtros,
              upload e criação.
            </li>
            <li>
              Sem permissão, aparece a mensagem de acesso restrito — peça ajuste ao administrador do time no{' '}
              <strong>Catálogo</strong> de papéis.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Indicadores no topo do painel" wide>
          <p className="text-sm">
            Os quatro cartões calculam-se <strong>no navegador</strong> sobre a lista <em>já filtrada</em>. Se mudar os
            filtros, os números acompanham a vista atual.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Documentos na lista</strong> — quantidade de linhas retornadas após o pedido.
            </li>
            <li>
              <strong>Vínculo Projectus</strong> — documentos com <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> preenchido.
            </li>
            <li>
              <strong>Em revisão</strong> — status igual a <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">REVISAR</code>.
            </li>
            <li>
              <strong>Com arquivo ou URL</strong> — campo <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">fileUrl</code> não vazio.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Lista e filtros">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Dados de <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/bibliotheca/documents</code>{' '}
              com parâmetros opcionais <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">category</code>,{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">status</code>,{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code>.
            </li>
            <li>
              O menu de categoria mostra o rótulo <strong>Portfólio</strong> para o valor armazenado{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">Projetos</code> (compatível com registros
              antigos).
            </li>
            <li>
              A ordenação padrão na API é pela <strong>data de criação</strong> descendente.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário Novo documento — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Título</dt>
              <dd>Obrigatório. Nome do documento na lista.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Categoria</dt>
              <dd>Obrigatória na API. Texto livre; exemplos sugeridos: Pesquisa, Jurídico, Portfólio, Financeiro.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Tamanho</dt>
              <dd>
                Obrigatório na API como texto (ex.: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">1.2 MB</code>
                ). Após upload bem-sucedido, o painel pode preencher com base nos bytes recebidos.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Status e visibilidade</dt>
              <dd>Valores fixos nos menus; gravam-se tal como escolhidos.</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Projeto (Projectus)</dt>
              <dd>
                Opcional. Lista projetos do mesmo time. Sem cadastro no Projectus, só aparece a opção sem vínculo.
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Tags e descrição</dt>
              <dd>Opcionais. Tags em uma linha separadas por vírgula.</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Upload de arquivo</dt>
              <dd>
                Opcional. <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/bibliotheca/upload</code>{' '}
                com <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">multipart/form-data</code>, limite{' '}
                <strong>15 MB</strong>. Resposta inclui <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">fileUrl</code>,{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">fileType</code> e{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">sizeBytes</code>.
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">URL e tipo (manual)</dt>
              <dd>
                Pode colar URL de arquivo hospedado fora do servidor e o tipo MIME ou extensão, sem passar pelo upload
                integrado.
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações — o que é real hoje" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Projectus</strong> — <em>Sim na UI:</em> seletor de projeto ao criar documento; filtro por{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> na lista.
            </li>
            <li>
              <strong>Scriptum</strong> — <em>Outro módulo:</em> ao criar projeto de escrita, pode escolher documento
              existente da Bibliotheca. Fluxo começa no Scriptum.
            </li>
            <li>
              <strong>Notepad</strong> — notas podem referenciar documentos por ID em outros fluxos; esta página não
              edita notas.
            </li>
            <li>
              <strong>Taskflow</strong> — coluna <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">taskId</code>{' '}
              na base; a API aceita o campo, mas <strong>não há</strong> seletor de tarefa nesta interface.
            </li>
            <li>
              <strong>BillTrak</strong> — <strong>não há</strong> sincronização automática de anexos ou lançamentos a
              partir da Bibliotheca nesta versão.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="APIs úteis (mesmo time)">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/bibliotheca/documents</code> — listar
              com filtros e limite.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/bibliotheca/documents</code> — criar
              (JSON; título, categoria e tamanho obrigatórios).
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PATCH /api/bibliotheca/documents</code> — atualizar
              por <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">id</code>; a página atual não expõe
              formulário de edição.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">DELETE /api/bibliotheca/documents?id=…</code> — remover.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Ícone de data e tema escuro" wide>
          <p className="text-sm">
            Esta tela <strong>não inclui</strong> campos de data. Quando outras páginas do Atlas usam{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">type=&quot;date&quot;</code> (ou datetime), o
            ícone do calendário no modo escuro segue os estilos globais em <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">app/globals.css</code>.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Erro ao salvar documento</strong> — confirme título, categoria e tamanho preenchidos; leia a
              mensagem em vermelho.
            </li>
            <li>
              <strong>Upload acima de 15 MB</strong> — reduza o arquivo ou use URL externa manual.
            </li>
            <li>
              <strong>Filtro de categoria não encontra nada</strong> — o valor tem que coincidir exatamente com o texto
              gravado (maiúsculas importam).
            </li>
            <li>
              <strong>Lista de projetos vazia</strong> — cadastre projetos no Projectus no mesmo time.
            </li>
            <li>
              <Link href="/help" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Centro de ajuda
              </Link>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Cadastro e organização</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Defina convenção de categorias e visibilidade com a equipe.</li>
              <li>Crie o registro com título claro; associe ao Projectus quando for documento de projeto.</li>
              <li>Faça upload ou cole URL; verifique se o tamanho exibido faz sentido para quem vai baixar.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Revisão e arquivo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Filtre status Revisar periodicamente e atualize para Ativo ou Arquivado.</li>
              <li>Mantenha tags alinhadas ao vocabulário do time.</li>
              <li>Arquive versões obsoletas em vez de apagar o histórico sem critério.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>Checklist semanal sugerido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Revisar itens em estado Revisar.</li>
              <li>Conferir se URLs públicos ainda respondem.</li>
              <li>Alinhar com o Projectus se novos projetos precisam de pasta documental.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
