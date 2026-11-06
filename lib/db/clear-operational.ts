import { sql } from 'drizzle-orm';
import { db } from './drizzle';

/**
 * Limpeza de dados operacionais (execução), preservando:
 * - cadastro base: users, teams, team_members
 * - comercial/config: saas_plans, saas_plan_modules, team_plans, platform_settings
 * - catálogo IA: ai_models
 *
 * Uso:
 *   pnpm db:clear:operational -- --confirm
 *
 * Opcional:
 *   pnpm db:clear:operational -- --confirm --include-config
 *   (limpa também tabelas de configuração por time, como webhooks, labels, colunas, etc.)
 */

const BASE_OPERATIONAL_TABLES = [
  // Auth operacional
  'password_reset_tokens',
  'invitations',
  'user_microsoft_graph_links',
  'user_google_calendar_links',

  // Log e auditoria operacional
  'activity_logs',
  'audit_events',
  'saas_customer_health',

  // Taskflow - execução
  'taskflow_task_events',
  'taskflow_task_external_links',
  'taskflow_task_attachments',
  'taskflow_task_assignees',
  'taskflow_task_labels',
  'taskflow_daily_checklist',
  'taskflow_interventions',
  'taskflow_portal_submissions',
  'taskflow_webhook_deliveries',
  'taskflow_cloud_ai_usage',
  'taskflow_template_board_requests',
  'taskflow_tasks',

  // Projectus - execução
  'projectus_task_dependencies',
  'projectus_cost_items',
  'projectus_cost_categories',
  'projectus_tasks',
  'projectus_milestones',
  'projectus_risks',
  'projectus_phases',
  'projectus_projects',

  // Reunify / Chronos - execução
  'reunify_meeting_captures',
  'reunify_action_items',
  'reunify_decisions',
  'reunify_agenda_items',
  'reunify_meetings',
  'chronos_agenda_items',

  // Outros módulos - dados operacionais
  'resourcehub_allocations',
  'resourcehub_resource_skills',
  'resourcehub_resources',
  'notepad_notes',
  'bibliotheca_documents',
  'scriptum_chapters',
  'scriptum_projects',
  'billtrak_transactions',
  'billtrak_bills',
  'billtrak_accounts',
] as const;

const CONFIG_TABLES_OPTIONAL = [
  // Configuração por time / catálogo de execução
  'team_taskflow_dev_integration',
  'taskflow_webhooks',
  'taskflow_advanced_rules',
  'taskflow_automation_rules',
  'taskflow_sprints',
  'taskflow_boards',
  'taskflow_columns',
  'taskflow_labels',
  'taskflow_status_definitions',
  'taskflow_task_type_definitions',
  'taskflow_semantic_embeddings',
  'taskflow_semantic_chunks',
  'taskflow_semantic_documents',
  'taskflow_semantic_index_queue',
  'taskflow_semantic_index_runs',
  'resourcehub_skills',
  'billtrak_categories',
] as const;

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function isUndefinedTableError(error: unknown) {
  const code = (error as { code?: string } | undefined)?.code;
  return code === '42P01';
}

async function truncateTables(tables: readonly string[]) {
  for (const table of tables) {
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`));
    } catch (error) {
      if (isUndefinedTableError(error)) {
        console.warn(`Tabela ausente (ignorada): ${table}`);
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  const confirmed = hasFlag('--confirm');
  const includeConfig = hasFlag('--include-config');

  if (!confirmed) {
    console.log('Nenhuma ação executada.');
    console.log('Use --confirm para executar a limpeza operacional.');
    console.log('Exemplo: pnpm db:clear:operational -- --confirm');
    process.exit(1);
  }

  const tablesToClear = includeConfig
    ? [...BASE_OPERATIONAL_TABLES, ...CONFIG_TABLES_OPTIONAL]
    : [...BASE_OPERATIONAL_TABLES];

  console.log('Iniciando limpeza operacional...');
  console.log(
    includeConfig
      ? 'Modo: operacional + configuração por time (--include-config).'
      : 'Modo: somente operacional (preserva configuração por time).',
  );
  console.log(`Total de tabelas alvo: ${tablesToClear.length}`);

  await truncateTables(tablesToClear);

  console.log('Limpeza concluída com sucesso.');
}

main()
  .catch((error) => {
    console.error('Falha ao limpar base operacional:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

