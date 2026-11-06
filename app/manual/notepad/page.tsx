import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function NotepadManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Notepad Pro — notas do time com pasta, tags, Markdown, status, visibilidade e vínculo opcional a projeto do Projectus; guia para uso sem treinamento presencial."
        backHref="/dashboard/notepad"
        backLabel="Voltar ao Notepad Pro"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Para que serve" wide>
          <p>
            O <strong>Notepad Pro</strong> é o <strong>caderno de notas partilhado do time</strong>: cada registo tem
            título obrigatório, pasta (texto livre, por padrão «Geral»), tags opcionais, status (Ativa, Revisar,
            Arquivada), visibilidade (Equipe, Gestão, Pessoal), corpo em <strong>Markdown</strong>, opção de fixar no
            topo e <strong>vínculo opcional a um projeto do módulo Projectus</strong> (portfólio do mesmo time).
          </p>
          <p>
            A página lista as notas mais recentes (limite de <strong>50</strong> por pedido), permite{' '}
            <strong>filtrar</strong> por pasta, status e projeto Projectus, e oferece um formulário para{' '}
            <strong>criar</strong> nota nova. Não substitui um wiki completo nem um gestor de ficheiros: é captura
            rápida de ideias, decisões e contexto.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Quem pode acessar">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Usuários com permissão <strong>Notepad — visualizar</strong> (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">notepad.view</code>)
              veem lista, filtros e o formulário «Nova nota».
            </li>
            <li>
              Sem permissão, a aplicação mostra «Acesso restrito» — o ajuste é feito no <strong>Catálogo</strong> de
              papéis do time, por um administrador.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Indicadores no topo do painel" wide>
          <p className="text-sm">
            Os quatro cartões calculam-se <strong>no navegador</strong> sobre a lista <em>já filtrada</em> que a página
            recebeu. Se mudar os filtros, os números acompanham a vista atual.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Notas na lista</strong> — quantidade de linhas exibidas após o pedido à API.
            </li>
            <li>
              <strong>Fixadas</strong> — notas com a opção de fixação ativa, dentro desta lista.
            </li>
            <li>
              <strong>Vínculo Projectus</strong> — notas com <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code>{' '}
              preenchido (projeto do portfólio).
            </li>
            <li>
              <strong>Com tags</strong> — notas cujo campo de tags não está vazio.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Lista, filtros e ordenação">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Os dados vêm de{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/notepad/notes</code> com parâmetros
              opcionais <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">folder</code>,{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">status</code>,{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> e limite máximo de 100 no
              servidor (a UI usa o limite padrão da API).
            </li>
            <li>
              A ordenação é pela <strong>última atualização</strong> (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">updatedAt</code>){' '}
              descendente — as mais recentes aparecem primeiro.
            </li>
            <li>
              O filtro de pasta compara o valor <strong>exato</strong> com o nome gravado na nota. Sugestões no menu:
              Geral, Universidade, <strong>Trabalho</strong>, Pessoal — pode escrever outro nome no formulário de nova
              nota; use sempre o mesmo texto para filtrar depois.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário «Nova nota» — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Título</dt>
              <dd>Obrigatório. Sem título, o botão «Adicionar nota» mostra erro e não envia o pedido.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Pasta</dt>
              <dd>
                Texto livre; se vazio, o servidor usa «Geral». Alinhe com os filtros (ex.: sempre «Trabalho» com a mesma
                capitalização).
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Tags</dt>
              <dd>Opcional. Uma linha com valores separados por vírgula; aparecem na lista como texto.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Status</dt>
              <dd>Ativa, Revisar ou Arquivada — valores fixos no menu suspenso.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Visibilidade</dt>
              <dd>Equipe, Gestão ou Pessoal — define o nível lógico de compartilhamento gravado na nota.</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Projeto (Projectus)</dt>
              <dd>
                Opcional. Lista os projetos do mesmo time (
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/projectus/projects</code>). Se não
                houver projetos cadastrados no Projectus, o menu fica só com «Sem vínculo ao Projectus».
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Corpo (Markdown)</dt>
              <dd>
                Opcional. A aplicação não pré-visualiza o Markdown nesta vista; serve para texto estruturado simples
                (títulos, listas, links).
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Fixar nota</dt>
              <dd>
                Caixa de opção: grava <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">pinned = true</code>.
                Na lista, aparece um destaque «Fixada».
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações — o que é real hoje" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Projectus</strong> — <em>Sim na UI:</em> escolher um projeto do portfólio ao criar a nota e filtrar
              a lista por <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code>.
            </li>
            <li>
              <strong>Scriptum</strong> — <em>Outro módulo:</em> ao criar um <strong>projeto de escrita</strong> no
              Scriptum, pode ligar uma nota existente do Notepad pelo identificador (
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">noteId</code>). Esse fluxo começa no
              Scriptum, não no formulário do Notepad.
            </li>
            <li>
              <strong>Taskflow / Bibliotheca</strong> — <em>Só modelo de dados / API:</em> existem campos{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">taskId</code> e{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">documentId</code> na base; o{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST</code> pode incluí-los, mas{' '}
              <strong>esta página não mostra</strong> seletores nem converte nota em tarefa automaticamente.
            </li>
            <li>
              <strong>Transcrição ou voz</strong> — <strong>não há</strong> gravação de áudio nem transcrição nativa
              ligada ao Notepad nesta versão.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="APIs úteis (mesmo time)">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/notepad/notes</code> — listar com
              filtros opcionais.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/notepad/notes</code> — criar (corpo
              JSON com os campos do formulário).
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PATCH /api/notepad/notes</code> — atualizar
              nota existente (corpo com <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">id</code>);{' '}
              <strong>não há</strong> formulário de edição nesta página — uso por integrações ou evolução futura da UI.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">DELETE /api/notepad/notes?id=…</code> — apagar
              por identificador.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Lista vazia com filtros</strong> — clique em «Todas as pastas» / «Todos os status» / «Qualquer
              projeto» e confira se gravou a pasta com o mesmo texto do filtro.
            </li>
            <li>
              <strong>Menu de projeto Projectus vazio</strong> — cadastre projetos no módulo Projectus no mesmo time.
            </li>
            <li>
              <strong>Erro ao salvar</strong> — confirme título preenchido e sessão autenticada; leia a mensagem em
              vermelho abaixo do formulário.
            </li>
            <li>
              <strong>Campo de data / calendário</strong> — o Notepad Pro <strong>não usa</strong> campo de data nesta
              tela. Em outras partes do Atlas (ex.: prazo no Scriptum), o ícone do calendário no modo escuro segue os
              estilos globais da aplicação.
            </li>
            <li>
              <Link href="/help" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Centro de ajuda
              </Link>{' '}
              para políticas gerais e contatos.
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Captura no dia a dia</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Abra o Notepad Pro e escolha a pasta mental (reunião, cliente, estudo).</li>
              <li>Crie nota com título claro; use tags se for voltar ao assunto em semanas.</li>
              <li>Se a decisão pertence a um projeto do portfólio, vincule ao Projectus no mesmo passo.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Revisão semanal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Filtre status «Revisar» e trate ou arquive cada item.</li>
              <li>Alinhe nomes de pastas duplicados (ex.: «cliente» vs «Cliente»).</li>
              <li>Confira se notas fixadas ainda merecem destaque.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>Checklist — antes de encerrar o expediente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Gravar decisões abertas que ainda estão só na cabeça.</li>
              <li>Atualizar vínculo ao Projectus se o tema mudou de iniciativa.</li>
              <li>Compartilhar com a equipe o que estava em «Pessoal» só se for pertinente.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
