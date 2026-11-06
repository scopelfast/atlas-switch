import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ScriptumManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Scriptum — projetos longos, metas de palavras, capítulos e vínculos opcionais ao Bibliotheca e Notepad; guia para uso sem treino presencial."
        backHref="/dashboard/scriptum"
        backLabel="Voltar ao Scriptum"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Para que serve" wide>
          <p>
            O <strong>Scriptum</strong> organiza <strong>escrita longa</strong> por <strong>projeto</strong> (tipos:
            artigo, tese, roteiro, livro): define <strong>meta de palavras</strong> e <strong>palavras já escritas</strong>{' '}
            (atualização manual na interface), <strong>estado editorial</strong> do projeto, <strong>data de
            entrega opcional</strong>, resumo e ligações opcionais a um <strong>documento do Bibliotheca</strong> ou a
            uma <strong>nota do Notepad</strong>. Cada projeto pode ter <strong>capítulos</strong> com título, posição,
            contagem de palavras e estado próprio.
          </p>
          <p>
            Não é um editor de texto rico embutido nesta página: o foco é <strong>planeamento, métricas e estrutura</strong>.
            O conteúdo pode viver no documento ou na nota ligados.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Quem pode aceder">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Utilizadores com permissão <strong>Scriptum — visualizar</strong> veem a lista, filtros, capítulos e
              formulários de criação.
            </li>
            <li>
              Sem permissão, aparece «Acesso restrito» — peça ajuste ao administrador do time (ex.: <strong>Catálogo</strong>).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Indicadores no topo do painel" wide>
          <p className="text-sm">
            Os quatro cartões calculam-se <strong>no cliente</strong> a partir da lista de projetos <em>já filtrada</em>{' '}
            pelos seletores «Tipo» e «Status». Se filtrar, os totais refletem só o que está visível.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Projetos</strong> — número de linhas na lista atual.
            </li>
            <li>
              <strong>Meta total</strong> — soma do campo <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">goalWords</code> desses projetos.
            </li>
            <li>
              <strong>Palavras escritas</strong> — soma de <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">currentWords</code> (atualize este número quando fizer sentido na sua rotina).
            </li>
            <li>
              <strong>Progresso geral</strong> — <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">(soma currentWords ÷ soma goalWords) × 100</code>, arredondado; se a meta total for zero, mostra «—».
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Lista de projetos e filtros">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Os filtros enviam parâmetros <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">type</code> e{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">status</code> para{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/scriptum/projects</code>.
            </li>
            <li>
              <strong>Clique num projeto</strong> para o realçar e carregar capítulos em{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/scriptum/chapters?projectId=…</code>.
            </li>
            <li>Tipos possíveis: Artigo, Tese, Roteiro, Livro. Estados: Rascunho, Em progresso, Revisão, Finalizado.</li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário «Novo projeto» — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Título</dt>
              <dd>Obrigatório. Nome do projeto de escrita.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Tipo e status</dt>
              <dd>Definem o tipo editorial e a fase do projeto; gravam-se tal como escolhidos.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Meta de palavras / Palavras atuais</dt>
              <dd>
                Números inteiros. A «meta» é o alvo; «atuais» é o progresso que a equipa regista (não há contagem
                automática de texto nesta vista).
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Prazo de entrega</dt>
              <dd>Opcional. Campo de data; o ícone do calendário segue o tema claro/escuro da aplicação.</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Resumo</dt>
              <dd>Opcional. Texto curto para contexto da equipa.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Vincular documento (Bibliotheca)</dt>
              <dd>
                Opcional. Lista até 50 documentos do time; grava <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">documentId</code> no projeto.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Vincular nota (Notepad)</dt>
              <dd>Opcional. Lista até 50 notas; grava <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">noteId</code>.</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Adicionar projeto</dt>
              <dd>
                Envia <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/scriptum/projects</code>. Em caso de erro da API, a mensagem aparece no formulário.
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Formulário «Novo capítulo» — campo a campo" wide>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Pré-requisito</dt>
              <dd>Selecione um projeto na lista à esquerda; sem seleção, o botão avisa no erro.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Título</dt>
              <dd>Obrigatório.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Posição</dt>
              <dd>Ordem entre capítulos (número inteiro; a API ordena por posição ascendente).</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Palavras</dt>
              <dd>Contagem associada ao capítulo (manual).</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Status</dt>
              <dd>Em progresso, Revisão ou Concluído — independente do status do projeto.</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Adicionar capítulo</dt>
              <dd>
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/scriptum/chapters</code> com{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> do projeto selecionado.
              </dd>
            </div>
          </dl>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações — o que é automático hoje">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Bibliotheca</strong> — <em>Sim na UI:</em> escolher documento na lista e gravar o ID no projeto.
            </li>
            <li>
              <strong>Notepad Pro</strong> — <em>Sim na UI:</em> idem para notas.
            </li>
            <li>
              <strong>Taskflow, Projectus, Chronos, ResourceHub, BillTrak…</strong> — <em>Não</em> há vínculo nem
              sincronização automática nesta página; use outros módulos manualmente se o fluxo o exigir.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial">
          <p className="text-sm">
            O Scriptum <strong>não utiliza IA</strong> nesta versão da interface (sem sugestões automáticas de texto nem
            revisão por modelo).
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Listas Bibliotheca / Notepad vazias</strong> — crie conteúdo nesses módulos no mesmo time ou
              verifique permissões de acesso às APIs.
            </li>
            <li>
              <strong>Progresso geral «—»</strong> — a soma das metas dos projetos filtrados é zero; ajuste filtros ou
              metas.
            </li>
            <li>
              <strong>Não consigo criar capítulo</strong> — confirme que clicou num projeto (realce em indigo) antes de
              gravar.
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
            <CardTitle>POP — Estruturação</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Crie o projeto com tipo e meta claros.</li>
              <li>Parta o texto em capítulos com posições ordenadas.</li>
              <li>Vincule documento ou nota quando o rascunho já existir fora do Scriptum.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Produção e revisão</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Atualize «palavras atuais» do projeto após blocos de escrita relevantes.</li>
              <li>Mude o estado do capítulo para «Revisão» quando enviar a revisores.</li>
              <li>Marque o projeto «Finalizado» quando encerrar a entrega.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>Checklist semanal sugerido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Rever filtros e projetos atrasados face ao prazo.</li>
              <li>Alinhar números de palavras com o que está no documento ligado.</li>
              <li>Planear próximos capítulos ou fechar os em revisão.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
