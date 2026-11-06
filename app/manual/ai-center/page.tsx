import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function AiCenterManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Catálogo de modelos (LLM, embeddings, ASR), estados e limites — infraestrutura de registo para a plataforma."
        backHref="/dashboard/ai-center"
        backLabel="Voltar à Central de IA"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Resumo" wide>
          <p>
            A Central de IA é o <strong>registo administrativo</strong> de modelos disponíveis para a instância: nome,
            fornecedor, tipo (LLM, embedding, ASR), endpoint, identificador do modelo e estado (ativo/pausado,
            padrão). Muitas capacidades dos módulos ainda usam heurísticas locais ou toggles em{' '}
            <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/control-integrations">
              Integrações globais
            </a>
            ; esta área prepara o terreno para orquestrações futuras sem misturar segredos na base de dados.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Papéis e permissões">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Na matriz actual, só o papel global <strong>platform_admin</strong> inclui <strong>ai.manage</strong>{' '}
              (menu Central de IA + APIs respeitam o mesmo critério que o Control Center).
            </li>
            <li>
              Utilizadores finais <strong>não</strong> alteram modelos aqui; ativam assistências nos módulos quando a
              política do time e da instância permitir.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações com outros módulos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Taskflow</strong> — chat na nuvem, assistência e busca semântica consomem fornecedores e chaves
              definidos noutros ecrãs; o catálogo aqui documenta <em>o quê</em> pode ser chamado quando a engenharia
              ligar inferência.
            </li>
            <li>
              <strong>Reunify</strong> — pipelines de transcrição/rascunho (E8.2, E8.13) podem referenciar modelos
              registados quando a evolução de produto unificar caminhos.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial neste módulo">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Este ecrã <strong>cataloga</strong> capacidades; não substitui opt-in por equipa nem os toggles de
              integrações globais.
            </li>
            <li>
              Distinga modelos <strong>OSS</strong> vs <strong>proprietários</strong> nas notas internas — impacta
              custo, residência de dados e revisão de contrato.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Modelo pausado mas a UI do módulo ainda oferece IA</strong> — pode haver caminho directo a API
              (ex. OpenAI) noutro toggle; alinhar com Integrações globais e documentação do módulo.
            </li>
            <li>
              <strong>Endpoint incorreto</strong> — valide URL, versão da API e cabeçalhos esperados pelo fornecedor
              antes de marcar como padrão.
            </li>
            <li>
              Ver também{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/help">
                Ajuda
              </a>{' '}
              (secção sobre IA na plataforma).
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Cadastro de modelos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Cadastre o modelo com tipo e fornecedor.</li>
              <li>Defina se é padrão e se está ativo.</li>
              <li>Inclua endpoint e versionamento.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Operação e custos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Mantenha apenas modelos necessários ativos.</li>
              <li>Revisar consumo e desempenho semanalmente.</li>
              <li>Registrar mudanças críticas em auditoria.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
