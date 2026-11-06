import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  date,
  uniqueIndex,
  primaryKey,
  index,
  real,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  /** E8.19 — leitura em voz alta de notificações Taskflow no cliente (requer opt-in do time). */
  taskflowTtsNotificationsEnabled: boolean('taskflow_tts_notifications_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

/** E8.12 — OAuth Microsoft Graph por utilizador (refresh token cifrado com derivado de AUTH_SECRET). */
export const userMicrosoftGraphLinks = pgTable('user_microsoft_graph_links', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  graphEmail: varchar('graph_email', { length: 255 }),
  encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** E8.16 — OAuth Google Calendar por utilizador (refresh token cifrado com derivado de AUTH_SECRET). */
export const userGoogleCalendarLinks = pgTable('user_google_calendar_links', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  googleEmail: varchar('google_email', { length: 255 }),
  encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  /** E7.3 — opt-in por equipa para agregados/heurísticas de «insights» (sem LLM externo). */
  taskflowAiInsightsEnabled: boolean('taskflow_ai_insights_enabled').notNull().default(false),
  /** E8.2 — opt-in: extrair rascunhos de acções a partir de texto/transcrição (revisão humana antes de gravar). */
  reunifyTranscriptDraftEnabled: boolean('reunify_transcript_draft_enabled').notNull().default(false),
  /** E8.18 — fornecedor ASR opcional para áudio carregado no Reunify: none | assemblyai | vosk (vosk = worker offline, ver doc). */
  reunifyAsrProvider: varchar('reunify_asr_provider', { length: 20 }).notNull().default('none'),
  /** E8.19 — o gestor permite que membros activem leitura em voz alta no Taskflow (navegador / futuro Coqui). */
  taskflowTtsNotificationsAllowed: boolean('taskflow_tts_notifications_allowed').notNull().default(false),
  /** E8.3 — opt-in: sugestões heurísticas no quadro (prioridade / carga; sem modelo externo). */
  taskflowAssistSuggestionsEnabled: boolean('taskflow_assist_suggestions_enabled').notNull().default(false),
  /** E8.7 — formulário público (activação por owner/admin; destino = coluna). */
  taskflowPublicPortalEnabled: boolean('taskflow_public_portal_enabled').notNull().default(false),
  taskflowPublicPortalSlug: varchar('taskflow_public_portal_slug', { length: 40 }),
  /** FK em SQL (0046); sem `.references` aqui para evitar ciclo teams ↔ colunas no TS. */
  taskflowPublicPortalColumnId: integer('taskflow_public_portal_column_id'),
  /** E8.11 — opt-in por equipa para chamadas a modelo na nuvem (gating em `platform_settings` + `.env`). */
  taskflowCloudAiEnabled: boolean('taskflow_cloud_ai_enabled').notNull().default(false),
  taskflowCloudAiProvider: varchar('taskflow_cloud_ai_provider', { length: 16 }),
  taskflowCloudAiMonthlyRequestCap: integer('taskflow_cloud_ai_monthly_request_cap')
    .notNull()
    .default(100),
  /** E8.15 — opt-in: indexar tarefas para busca por similaridade (pgvector + embeddings OpenAI). */
  taskflowSemanticSearchEnabled: boolean('taskflow_semantic_search_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

/** E8.10 — segredo para `POST /api/taskflow/inbound/dev` (não exposto no GET /api/team). */
export const teamTaskflowDevIntegration = pgTable('team_taskflow_dev_integration', {
  teamId: integer('team_id')
    .primaryKey()
    .references(() => teams.id, { onDelete: 'cascade' }),
  inboundSecret: varchar('inbound_secret', { length: 80 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** E8.11 — contadores mensais por equipa (YYYY-MM em UTC). */
export const taskflowCloudAiUsage = pgTable(
  'taskflow_cloud_ai_usage',
  {
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    periodYm: varchar('period_ym', { length: 7 }).notNull(),
    requestCount: integer('request_count').notNull().default(0),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.periodYm] }),
  }),
);

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 32 }).notNull(),
  reportsToUserId: integer('reports_to_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

/** M2.5 — token opaco (hash SHA-256 na BD); não reutiliza convites. */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  invitedName: varchar('invited_name', { length: 100 }),
  /** Superior hierárquico (M1.4): obrigatório em novos convites para membro/supervisor. */
  reportsToUserId: integer('reports_to_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  /** M2.1 — token opaco (só hash na BD). */
  tokenHash: varchar('token_hash', { length: 64 }),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  /** M2.2 — confirmação de e-mail ao abrir o link. */
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const taskflowBoards = pgTable('taskflow_boards', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  /** E8.8 — quadro origem ao criar a partir de modelo (FK em SQL `0047`). */
  clonedFromBoardId: integer('cloned_from_board_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** E8.8 — idempotência `clientRequestId` em «criar quadro a partir de modelo». */
export const taskflowTemplateBoardRequests = pgTable(
  'taskflow_template_board_requests',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    clientRequestId: varchar('client_request_id', { length: 80 }).notNull(),
    boardId: integer('board_id')
      .notNull()
      .references(() => taskflowBoards.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    teamClientUnique: uniqueIndex('taskflow_template_board_requests_team_client_unique').on(
      t.teamId,
      t.clientRequestId,
    ),
  }),
);

export const taskflowColumns = pgTable('taskflow_columns', {
  id: serial('id').primaryKey(),
  boardId: integer('board_id')
    .notNull()
    .references(() => taskflowBoards.id),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
  phaseType: varchar('phase_type', { length: 16 }).notNull().default('PRODUCTION'),
  maxStayHours: integer('max_stay_hours'),
  stripeColor: varchar('stripe_color', { length: 32 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** M5.1 — catálogo de status por time (rótulo, situação fixa, cor). */
export const taskflowStatusDefinitions = pgTable(
  'taskflow_status_definitions',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    fixedSituation: varchar('fixed_situation', { length: 24 }).notNull(),
    color: varchar('color', { length: 32 }).notNull().default('slate'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamCodeUnique: uniqueIndex('taskflow_status_team_code_unique').on(t.teamId, t.code),
  }),
);

/** M6.1 — tipos de tarefa extensíveis por time (código + nome); tipos nativos vivem em `lib/taskflow/task-type.ts`. */
export const taskflowTaskTypeDefinitions = pgTable(
  'taskflow_task_type_definitions',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamCodeUnique: uniqueIndex('taskflow_task_type_team_code_unique').on(t.teamId, t.code),
  }),
);

/** E8.9 — timebox leve por time (filtro no quadro; não substitui Projectus). */
export const taskflowSprints = pgTable('taskflow_sprints', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taskflowTasks = pgTable(
  'taskflow_tasks',
  {
    id: serial('id').primaryKey(),
    boardId: integer('board_id')
      .notNull()
      .references(() => taskflowBoards.id),
    columnId: integer('column_id')
      .notNull()
      .references(() => taskflowColumns.id),
    /** E8.9 — subtarefa de outra tarefa do mesmo quadro (FK em SQL `0048`). */
    parentTaskId: integer('parent_task_id'),
    /** E8.9 — sprint opcional (`taskflow_sprints` do mesmo time). */
    sprintId: integer('sprint_id'),
    projectId: integer('project_id'),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    taskType: varchar('task_type', { length: 40 }).notNull().default('generic'),
    priority: varchar('priority', { length: 20 }).notNull().default('MEDIUM'),
    statusId: integer('status_id')
      .notNull()
      .references(() => taskflowStatusDefinitions.id),
    position: integer('position').notNull().default(0),
    dueDate: timestamp('due_date'),
    /** M6.2 — início previsto (data e hora). */
    plannedStartAt: timestamp('planned_start_at', { withTimezone: true }),
    /** M6.2 — esforço estimado em horas (decimais permitidos). */
    estimatedDurationHours: real('estimated_duration_hours'),
    assigneeId: integer('assignee_id').references(() => users.id),
    createdById: integer('created_by_id').references(() => users.id),
    columnEnteredAt: timestamp('column_entered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    /** M6.6 — DAILY | WEEKLY | MONTHLY na tarefa-molde (instâncias = null). */
    recurrenceRule: varchar('recurrence_rule', { length: 16 }),
    recurrenceSeriesKey: varchar('recurrence_series_key', { length: 40 }),
    recurrenceOccurrenceKey: varchar('recurrence_occurrence_key', { length: 40 }),
    recurrenceUntil: timestamp('recurrence_until', { withTimezone: true }),
    completedAt: timestamp('completed_at'),
  },
  (t) => ({
    recurrenceInstanceUnique: uniqueIndex('taskflow_tasks_recurrence_instance_unique')
      .on(t.recurrenceSeriesKey, t.recurrenceOccurrenceKey)
      .where(sql`${t.recurrenceOccurrenceKey} is not null`),
  }),
);

/** E8.10 — ligação externa (commit, PR, ticket) associada a uma tarefa. */
export const taskflowTaskExternalLinks = pgTable('taskflow_task_external_links', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  taskId: integer('task_id')
    .notNull()
    .references(() => taskflowTasks.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 32 }).notNull().default('manual'),
  url: text('url').notNull(),
  title: varchar('title', { length: 240 }),
  externalRef: varchar('external_ref', { length: 120 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** M6.3 — responsáveis N:N (assignee_id na tarefa = primeiro da lista, legado/UI). */
export const taskflowTaskAssignees = pgTable(
  'taskflow_task_assignees',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => taskflowTasks.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    taskUserUnique: uniqueIndex('taskflow_task_assignees_task_user_unique').on(t.taskId, t.userId),
  }),
);

/** M6.5 — anexos (ficheiro em disco sob `uploads/taskflow-attachments`; download via API). */
export const taskflowTaskAttachments = pgTable('taskflow_task_attachments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => taskflowTasks.id, { onDelete: 'cascade' }),
  uploadedById: integer('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
  fileNameOnDisk: varchar('file_name_on_disk', { length: 200 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** M7.1 / M7.2 — intervenção na tarefa (`TIMER` = sessão aberta; `MANUAL` = registo com início/fim editáveis). */
export const taskflowInterventions = pgTable(
  'taskflow_interventions',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    taskId: integer('task_id')
      .notNull()
      .references(() => taskflowTasks.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    reportedStatus: varchar('reported_status', { length: 200 }),
    details: text('details'),
    /** `TIMER` = M7.1; `MANUAL` = M7.2 (sempre com `ended_at` preenchido na criação). */
    source: varchar('source', { length: 16 }).notNull().default('TIMER'),
    /** M7.3 — próximo ping de inatividade (operador); ao «Sim» avança +2h. */
    nextIdlePingAt: timestamp('next_idle_ping_at', { withTimezone: true }),
    /** M7.3 — fim da janela de 15 min após mostrar o ping; passado este instante → pausa automática. */
    idleResponseDeadlineAt: timestamp('idle_response_deadline_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTimerOpenUnique: uniqueIndex('taskflow_interventions_user_timer_open_unique')
      .on(t.userId)
      .where(sql`${t.endedAt} is null and ${t.source} = 'TIMER'`),
  }),
);

export const projectusProjects = pgTable('projectus_projects', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: varchar('name', { length: 200 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('EM_ANDAMENTO'),
  dueDate: timestamp('due_date'),
  budgetCents: integer('budget_cents').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const projectusPhases = pgTable('projectus_phases', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projectusProjects.id),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: varchar('status', { length: 20 }).notNull().default('PLANEJADA'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const projectusTasks = pgTable('projectus_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projectusProjects.id),
  phaseId: integer('phase_id').references(() => projectusPhases.id),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  assigneeId: integer('assignee_id').references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('ABERTA'),
  priority: varchar('priority', { length: 20 }).notNull().default('MEDIA'),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  effortHours: integer('effort_hours'),
  progress: integer('progress').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const projectusTaskDependencies = pgTable('projectus_task_dependencies', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => projectusTasks.id),
  dependsOnTaskId: integer('depends_on_task_id')
    .notNull()
    .references(() => projectusTasks.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const projectusMilestones = pgTable('projectus_milestones', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projectusProjects.id),
  name: varchar('name', { length: 200 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ABERTO'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const projectusRisks = pgTable('projectus_risks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projectusProjects.id),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  probability: integer('probability').notNull().default(3),
  impact: integer('impact').notNull().default(3),
  status: varchar('status', { length: 20 }).notNull().default('ABERTO'),
  mitigation: text('mitigation'),
  ownerId: integer('owner_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Catálogo de categorias de custo por equipa (chave estável para relatórios). */
export const projectusCostCategories = pgTable(
  'projectus_cost_categories',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 40 }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    active: boolean('active').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamCodeUnique: uniqueIndex('projectus_cost_categories_team_id_code_unique').on(t.teamId, t.code),
  }),
);

export const projectusCostItems = pgTable('projectus_cost_items', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projectusProjects.id),
  phaseId: integer('phase_id').references(() => projectusPhases.id),
  taskId: integer('task_id').references(() => projectusTasks.id),
  type: varchar('type', { length: 20 }).notNull().default('PLANEJADO'),
  /** Texto de exibição (desnormalizado): label da categoria ou "Outros: …". */
  category: varchar('category', { length: 80 }).notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => projectusCostCategories.id, { onDelete: 'restrict' }),
  /** Detalhe livre quando a categoria é OUTROS. */
  categoryDetail: varchar('category_detail', { length: 200 }),
  amountCents: integer('amount_cents').notNull(),
  incurredAt: date('incurred_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const taskflowLabels = pgTable('taskflow_labels', {
  id: serial('id').primaryKey(),
  boardId: integer('board_id')
    .notNull()
    .references(() => taskflowBoards.id),
  name: varchar('name', { length: 60 }).notNull(),
  color: varchar('color', { length: 20 }).notNull().default('slate'),
  priority: varchar('priority', { length: 20 }).notNull().default('MEDIUM'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const taskflowTaskLabels = pgTable('taskflow_task_labels', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => taskflowTasks.id),
  labelId: integer('label_id')
    .notNull()
    .references(() => taskflowLabels.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const taskflowAutomationRules = pgTable('taskflow_automation_rules', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  autoAssignCreator: boolean('auto_assign_creator').notNull().default(false),
  autoHighPriorityOnDue: boolean('auto_high_priority_on_due').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const taskflowAdvancedRules = pgTable('taskflow_advanced_rules', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: varchar('name', { length: 120 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  dueInDays: integer('due_in_days'),
  priorityEquals: varchar('priority_equals', { length: 20 }),
  assigneeMissing: boolean('assignee_missing').notNull().default(false),
  actionSetPriority: varchar('action_set_priority', { length: 20 }),
  actionAssignCreator: boolean('action_assign_creator').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** E8.5 — URL que recebe POST JSON em eventos Taskflow (dedupe em `taskflow_webhook_deliveries`). */
export const taskflowWebhooks = pgTable('taskflow_webhooks', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: varchar('name', { length: 100 }).notNull(),
  targetUrl: text('target_url').notNull(),
  /** Opcional: HMAC-SHA256 do corpo em `X-Atlas-Webhook-Signature` (hex). */
  secret: varchar('secret', { length: 128 }),
  /** Lista separada por vírgulas: task.created, task.updated */
  events: varchar('events', { length: 200 }).notNull().default('task.created,task.updated'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const taskflowWebhookDeliveries = pgTable(
  'taskflow_webhook_deliveries',
  {
    id: serial('id').primaryKey(),
    webhookId: integer('webhook_id')
      .notNull()
      .references(() => taskflowWebhooks.id, { onDelete: 'cascade' }),
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),
    httpStatus: integer('http_status'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    webhookDedupeUnique: uniqueIndex('taskflow_webhook_deliveries_webhook_dedupe_unique').on(
      t.webhookId,
      t.dedupeKey,
    ),
  }),
);

/** E8.7 — pedidos do formulário público (moderação antes de virar tarefa). */
export const taskflowPortalSubmissions = pgTable(
  'taskflow_portal_submissions',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    submitterName: varchar('submitter_name', { length: 120 }),
    submitterEmail: varchar('submitter_email', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    taskId: integer('task_id').references(() => taskflowTasks.id, { onDelete: 'set null' }),
  },
  (t) => ({
    teamStatusIdx: index('taskflow_portal_submissions_team_status_idx').on(t.teamId, t.status),
  }),
);

export const taskflowTaskEvents = pgTable('taskflow_task_events', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => taskflowTasks.id),
  type: varchar('type', { length: 20 }).notNull(),
  fromColumnId: integer('from_column_id'),
  toColumnId: integer('to_column_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const taskflowDailyChecklist = pgTable('taskflow_daily_checklist', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  taskId: integer('task_id')
    .notNull()
    .references(() => taskflowTasks.id, { onDelete: 'cascade' }),
  checklistDate: date('checklist_date').notNull(),
  position: integer('position').notNull().default(0),
  checked: boolean('checked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chronosAgendaItems = pgTable(
  'chronos_agenda_items',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    date: date('date').notNull().defaultNow(),
    startTime: varchar('start_time', { length: 10 }).notNull(),
    endTime: varchar('end_time', { length: 10 }),
    durationMinutes: integer('duration_minutes'),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 20 }).notNull(),
    location: varchar('location', { length: 120 }),
    reminderMinutes: integer('reminder_minutes'),
    recurrence: varchar('recurrence', { length: 20 }),
    timezone: varchar('timezone', { length: 64 }).default('America/Sao_Paulo'),
    source: varchar('source', { length: 20 }).notNull().default('MANUAL'),
    status: varchar('status', { length: 20 }).notNull().default('AGENDADO'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    /** M6.9 — espelho do prazo Taskflow (só se módulo Chronos no plano). */
    taskflowTaskId: integer('taskflow_task_id').references(() => taskflowTasks.id, {
      onDelete: 'cascade',
    }),
    /** Minutos antes do evento: D-1, H-1, 30m, 15m, 0 (CSV). */
    taskflowReminderOffsets: varchar('taskflow_reminder_offsets', { length: 80 }),
    /** Atalho Reunify → Chronos: no máximo um compromisso por reunião no mesmo time. */
    reunifyMeetingId: integer('reunify_meeting_id').references(() => reunifyMeetings.id, {
      onDelete: 'set null',
    }),
    /** IM2.7 — compromisso espelhado por participante/alocado (agenda individual). */
    participantUserId: integer('participant_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    chronosTeamTaskflowTaskUnique: uniqueIndex('chronos_agenda_items_team_taskflow_task_unique')
      .on(t.teamId, t.taskflowTaskId)
      .where(sql`${t.taskflowTaskId} is not null`),
    chronosTeamReunifyMeetingUnique: uniqueIndex('chronos_agenda_items_team_reunify_meeting_unique')
      .on(t.teamId, t.reunifyMeetingId)
      .where(sql`${t.reunifyMeetingId} is not null and ${t.participantUserId} is null`),
    chronosTeamReunifyMeetingParticipantUnique: uniqueIndex(
      'chronos_agenda_items_team_reunify_meeting_participant_unique',
    )
      .on(t.teamId, t.reunifyMeetingId, t.participantUserId)
      .where(sql`${t.reunifyMeetingId} is not null and ${t.participantUserId} is not null`),
  }),
);

export const reunifyMeetings = pgTable(
  'reunify_meetings',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    date: date('date').notNull().defaultNow(),
    startTime: varchar('start_time', { length: 10 }).notNull(),
    endTime: varchar('end_time', { length: 10 }),
    durationMinutes: integer('duration_minutes'),
    title: varchar('title', { length: 200 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    cancelReason: text('cancel_reason'),
    canceledAt: timestamp('canceled_at'),
    canceledByUserId: integer('canceled_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Vincula reunião nova criada por reagendamento à reunião original. */
    rescheduledFromMeetingId: integer('rescheduled_from_meeting_id'),
    location: varchar('location', { length: 120 }),
    summary: text('summary'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    rescheduledFromMeetingFk: foreignKey({
      columns: [t.rescheduledFromMeetingId],
      foreignColumns: [t.id],
      name: 'reunify_meetings_rescheduled_from_meeting_id_fkey',
    }).onDelete('set null'),
  }),
);

export const reunifyMeetingHistory = pgTable(
  'reunify_meeting_history',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    meetingId: integer('meeting_id').notNull(),
    actionType: varchar('action_type', { length: 40 }).notNull(),
    payload: text('payload'),
    performedByUserId: integer('performed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    teamMeetingIdx: index('reunify_meeting_history_team_meeting_idx').on(t.teamId, t.meetingId),
    createdAtIdx: index('reunify_meeting_history_created_at_idx').on(t.createdAt),
  }),
);

export const integrationSyncEvents = pgTable(
  'integration_sync_events',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    integrationKey: varchar('integration_key', { length: 60 }).notNull(),
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    entityId: integer('entity_id'),
    operation: varchar('operation', { length: 40 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    message: text('message'),
    payload: text('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    teamKeyCreatedIdx: index('integration_sync_events_team_key_created_idx').on(
      t.teamId,
      t.integrationKey,
      t.createdAt,
    ),
    teamEntityCreatedIdx: index('integration_sync_events_team_entity_created_idx').on(
      t.teamId,
      t.entityType,
      t.entityId,
      t.createdAt,
    ),
  }),
);

export const reunifyReasonCatalog = pgTable(
  'reunify_reason_catalog',
  {
    id: serial('id').primaryKey(),
    reasonType: varchar('reason_type', { length: 20 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reasonTypeCodeUnique: uniqueIndex('reunify_reason_catalog_reason_type_code_unique').on(
      t.reasonType,
      t.code,
    ),
    reasonTypeActiveIdx: index('reunify_reason_catalog_reason_type_active_idx').on(t.reasonType, t.active),
  }),
);

/** IM2.6 — participantes da reunião (utilizadores do mesmo time). */
export const reunifyMeetingParticipants = pgTable(
  'reunify_meeting_participants',
  {
    id: serial('id').primaryKey(),
    meetingId: integer('meeting_id')
      .notNull()
      .references(() => reunifyMeetings.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reunifyMeetingParticipantUnique: uniqueIndex('reunify_meeting_participants_meeting_user_unique').on(
      t.meetingId,
      t.userId,
    ),
  }),
);

/** E8.17 — ligação a gravação externa ou ficheiro (áudio/vídeo) associado à reunião. */
export const reunifyMeetingCaptures = pgTable('reunify_meeting_captures', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => reunifyMeetings.id, { onDelete: 'cascade' }),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 16 }).notNull(),
  externalUrl: text('external_url'),
  storedPath: varchar('stored_path', { length: 500 }),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }),
  sizeBytes: integer('size_bytes').notNull().default(0),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reunifyAgendaItems = pgTable('reunify_agenda_items', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => reunifyMeetings.id),
  title: varchar('title', { length: 200 }).notNull(),
  owner: varchar('owner', { length: 120 }),
  durationMinutes: integer('duration_minutes'),
  status: varchar('status', { length: 20 }).notNull().default('ABERTO'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const reunifyDecisions = pgTable('reunify_decisions', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => reunifyMeetings.id),
  title: varchar('title', { length: 200 }).notNull(),
  owner: varchar('owner', { length: 120 }),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reunifyActionItems = pgTable(
  'reunify_action_items',
  {
    id: serial('id').primaryKey(),
    meetingId: integer('meeting_id')
      .notNull()
      .references(() => reunifyMeetings.id),
    title: varchar('title', { length: 200 }).notNull(),
    ownerId: integer('owner_id').references(() => users.id),
    dueDate: date('due_date'),
    status: varchar('status', { length: 20 }).notNull().default('ABERTO'),
    notes: text('notes'),
    /** M6.11 — tarefa Taskflow criada a partir desta ação (idempotência ao repetir exportar). */
    taskflowTaskId: integer('taskflow_task_id').references(() => taskflowTasks.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    reunifyActionTaskflowTaskUnique: uniqueIndex('reunify_action_items_taskflow_task_id_unique')
      .on(t.taskflowTaskId)
      .where(sql`${t.taskflowTaskId} is not null`),
  }),
);

export const bibliothecaDocuments = pgTable('bibliotheca_documents', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  projectId: integer('project_id').references(() => projectusProjects.id),
  taskId: integer('task_id').references(() => taskflowTasks.id),
  createdById: integer('created_by_id').references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  category: varchar('category', { length: 120 }).notNull(),
  size: varchar('size', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ATIVO'),
  visibility: varchar('visibility', { length: 20 }).notNull().default('EQUIPE'),
  tags: text('tags'),
  description: text('description'),
  fileUrl: text('file_url'),
  fileType: varchar('file_type', { length: 30 }),
  source: varchar('source', { length: 30 }).default('UPLOAD'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const notepadNotes = pgTable('notepad_notes', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  createdById: integer('created_by_id').references(() => users.id),
  projectId: integer('project_id').references(() => projectusProjects.id),
  taskId: integer('task_id').references(() => taskflowTasks.id),
  documentId: integer('document_id').references(() => bibliothecaDocuments.id),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  folder: varchar('folder', { length: 120 }).notNull().default('Geral'),
  tags: text('tags'),
  status: varchar('status', { length: 20 }).notNull().default('ATIVA'),
  visibility: varchar('visibility', { length: 20 }).notNull().default('EQUIPE'),
  pinned: boolean('pinned').notNull().default(false),
  source: varchar('source', { length: 30 }).default('MANUAL'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const scriptumProjects = pgTable('scriptum_projects', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  createdById: integer('created_by_id').references(() => users.id),
  documentId: integer('document_id').references(() => bibliothecaDocuments.id),
  noteId: integer('note_id').references(() => notepadNotes.id),
  title: varchar('title', { length: 200 }).notNull(),
  type: varchar('type', { length: 40 }).notNull().default('ARTIGO'),
  status: varchar('status', { length: 20 }).notNull().default('RASCUNHO'),
  goalWords: integer('goal_words').notNull().default(1000),
  currentWords: integer('current_words').notNull().default(0),
  dueDate: date('due_date'),
  summary: text('summary'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const scriptumChapters = pgTable('scriptum_chapters', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => scriptumProjects.id),
  title: varchar('title', { length: 200 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('EM_PROGRESSO'),
  wordCount: integer('word_count').notNull().default(0),
  position: integer('position').notNull().default(0),
  content: text('content'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const saasPlans = pgTable('saas_plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull().default(0),
  stripeProductId: text('stripe_product_id'),
  stripePriceId: text('stripe_price_id'),
  billingInterval: varchar('billing_interval', { length: 20 }).notNull().default('MONTHLY'),
  maxUsers: integer('max_users').notNull().default(5),
  maxStorageGb: integer('max_storage_gb').notNull().default(50),
  aiEnabled: boolean('ai_enabled').notNull().default(true),
  /** E1.1 — vagas de papel «admin» no time (owner não conta). Planos add-on / Enterprise podem ser > 1. */
  maxTeamAdminSlots: integer('max_team_admin_slots').notNull().default(1),
  /** Quando true, o plano não entra em novas associações comerciais (catálogo “bloqueado”). */
  catalogSuspended: boolean('catalog_suspended').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const saasPlanModules = pgTable('saas_plan_modules', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id')
    .notNull()
    .references(() => saasPlans.id),
  moduleKey: varchar('module_key', { length: 50 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
});

export const teamPlans = pgTable('team_plans', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  planId: integer('plan_id')
    .notNull()
    .references(() => saasPlans.id),
  status: varchar('status', { length: 20 }).notNull().default('ATIVO'),
  negotiatedPriceCents: integer('negotiated_price_cents'),
  billingCycleDay: integer('billing_cycle_day').notNull().default(5),
  nextInvoiceDate: date('next_invoice_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const auditEvents = pgTable('audit_events', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id),
  actorUserId: integer('actor_user_id').references(() => users.id),
  module: varchar('module', { length: 50 }).notNull(),
  action: varchar('action', { length: 120 }).notNull(),
  detail: text('detail'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const saasCustomerHealth = pgTable('saas_customer_health', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  healthScore: integer('health_score').notNull().default(70),
  churnRisk: varchar('churn_risk', { length: 20 }).notNull().default('MEDIO'),
  lastActivityAt: timestamp('last_activity_at'),
  usageScore: integer('usage_score').notNull().default(0),
  planFitScore: integer('plan_fit_score').notNull().default(0),
  supportScore: integer('support_score').notNull().default(0),
  recommendation: text('recommendation'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** I8.4 — toggles da instância; chaves `secrets.*` reservadas a segredos (ex.: AssemblyAI) — ver `lib/db/platform-secrets.ts`. */
export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 96 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiModels = pgTable('ai_models', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  provider: varchar('provider', { length: 80 }).notNull(),
  type: varchar('type', { length: 40 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PAUSADO'),
  endpoint: text('endpoint'),
  modelId: varchar('model_id', { length: 120 }),
  isDefault: boolean('is_default').notNull().default(false),
  isOpenSource: boolean('is_open_source').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const resourcehubResources = pgTable('resourcehub_resources', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('DISPONIVEL'),
  capacityHoursPerWeek: integer('capacity_hours_per_week').notNull().default(40),
  costRateCents: integer('cost_rate_cents').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const resourcehubSkills = pgTable('resourcehub_skills', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const resourcehubResourceSkills = pgTable('resourcehub_resource_skills', {
  id: serial('id').primaryKey(),
  resourceId: integer('resource_id')
    .notNull()
    .references(() => resourcehubResources.id),
  skillId: integer('skill_id')
    .notNull()
    .references(() => resourcehubSkills.id),
  level: integer('level').notNull().default(3),
});

export const resourcehubAllocations = pgTable('resourcehub_allocations', {
  id: serial('id').primaryKey(),
  resourceId: integer('resource_id')
    .notNull()
    .references(() => resourcehubResources.id),
  projectId: integer('project_id').references(() => projectusProjects.id),
  taskId: integer('task_id').references(() => taskflowTasks.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  hoursPerWeek: integer('hours_per_week').notNull().default(8),
  status: varchar('status', { length: 20 }).notNull().default('ATIVO'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const billtrakAccounts = pgTable('billtrak_accounts', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  balanceCents: integer('balance_cents').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const billtrakCategories = pgTable('billtrak_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const billtrakBills = pgTable('billtrak_bills', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  title: varchar('title', { length: 200 }).notNull(),
  categoryId: integer('category_id').references(() => billtrakCategories.id),
  projectId: integer('project_id').references(() => projectusProjects.id),
  status: varchar('status', { length: 20 }).notNull().default('PENDENTE'),
  amountCents: integer('amount_cents').notNull(),
  dueDate: date('due_date').notNull(),
  paidAt: date('paid_at'),
  recurring: boolean('recurring').notNull().default(false),
  recurrenceRule: varchar('recurrence_rule', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const billtrakTransactions = pgTable('billtrak_transactions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  accountId: integer('account_id').references(() => billtrakAccounts.id),
  billId: integer('bill_id').references(() => billtrakBills.id),
  type: varchar('type', { length: 20 }).notNull(),
  description: varchar('description', { length: 200 }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  occurredAt: date('occurred_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  taskflowBoards: many(taskflowBoards),
  taskflowInterventions: many(taskflowInterventions),
  taskflowStatusDefinitions: many(taskflowStatusDefinitions),
  taskflowTaskTypeDefinitions: many(taskflowTaskTypeDefinitions),
  taskflowAutomationRules: many(taskflowAutomationRules),
  taskflowAdvancedRules: many(taskflowAdvancedRules),
  projectusProjects: many(projectusProjects),
  projectusPhases: many(projectusPhases),
  projectusTasks: many(projectusTasks),
  projectusMilestones: many(projectusMilestones),
  projectusRisks: many(projectusRisks),
  projectusCostCategories: many(projectusCostCategories),
  chronosAgendaItems: many(chronosAgendaItems),
  reunifyMeetings: many(reunifyMeetings),
  reunifyAgendaItems: many(reunifyAgendaItems),
  reunifyDecisions: many(reunifyDecisions),
  reunifyActionItems: many(reunifyActionItems),
  bibliothecaDocuments: many(bibliothecaDocuments),
  notepadNotes: many(notepadNotes),
  scriptumProjects: many(scriptumProjects),
  teamPlans: many(teamPlans),
  auditEvents: many(auditEvents),
  customerHealth: many(saasCustomerHealth),
  resourcehubResources: many(resourcehubResources),
  resourcehubAllocations: many(resourcehubAllocations),
  billtrakAccounts: many(billtrakAccounts),
  billtrakBills: many(billtrakBills),
  billtrakTransactions: many(billtrakTransactions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  teamMembersReportingTo: many(teamMembers, { relationName: 'teamMemberReportsTo' }),
  invitationsSent: many(invitations),
  invitationsAsReportsTarget: many(invitations, { relationName: 'invitationReportsTo' }),
  passwordResetTokens: many(passwordResetTokens),
  taskflowAssignedTasks: many(taskflowTasks, { relationName: 'taskflowAssignee' }),
  taskflowCreatedTasks: many(taskflowTasks, { relationName: 'taskflowCreator' }),
  taskflowTaskAssigneeRows: many(taskflowTaskAssignees, {
    relationName: 'taskflowTaskAssigneeMember',
  }),
  taskflowAttachmentsUploaded: many(taskflowTaskAttachments, {
    relationName: 'taskflowAttachmentUploader',
  }),
  taskflowInterventions: many(taskflowInterventions),
  notepadNotes: many(notepadNotes),
  scriptumProjects: many(scriptumProjects),
  auditEvents: many(auditEvents),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
  reportsToUser: one(users, {
    fields: [invitations.reportsToUserId],
    references: [users.id],
    relationName: 'invitationReportsTo',
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  reportsToUser: one(users, {
    fields: [teamMembers.reportsToUserId],
    references: [users.id],
    relationName: 'teamMemberReportsTo',
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const taskflowBoardsRelations = relations(taskflowBoards, ({ one, many }) => ({
  team: one(teams, {
    fields: [taskflowBoards.teamId],
    references: [teams.id],
  }),
  columns: many(taskflowColumns),
  tasks: many(taskflowTasks),
  labels: many(taskflowLabels),
}));

export const taskflowColumnsRelations = relations(taskflowColumns, ({ one, many }) => ({
  board: one(taskflowBoards, {
    fields: [taskflowColumns.boardId],
    references: [taskflowBoards.id],
  }),
  tasks: many(taskflowTasks),
}));

export const taskflowStatusDefinitionsRelations = relations(
  taskflowStatusDefinitions,
  ({ one, many }) => ({
    team: one(teams, {
      fields: [taskflowStatusDefinitions.teamId],
      references: [teams.id],
    }),
    tasks: many(taskflowTasks),
  }),
);

export const taskflowTaskTypeDefinitionsRelations = relations(
  taskflowTaskTypeDefinitions,
  ({ one }) => ({
    team: one(teams, {
      fields: [taskflowTaskTypeDefinitions.teamId],
      references: [teams.id],
    }),
  }),
);

export const taskflowTasksRelations = relations(taskflowTasks, ({ one, many }) => ({
  board: one(taskflowBoards, {
    fields: [taskflowTasks.boardId],
    references: [taskflowBoards.id],
  }),
  column: one(taskflowColumns, {
    fields: [taskflowTasks.columnId],
    references: [taskflowColumns.id],
  }),
  statusDefinition: one(taskflowStatusDefinitions, {
    fields: [taskflowTasks.statusId],
    references: [taskflowStatusDefinitions.id],
  }),
  project: one(projectusProjects, {
    fields: [taskflowTasks.projectId],
    references: [projectusProjects.id],
  }),
  assignee: one(users, {
    fields: [taskflowTasks.assigneeId],
    references: [users.id],
    relationName: 'taskflowAssignee',
  }),
  createdBy: one(users, {
    fields: [taskflowTasks.createdById],
    references: [users.id],
    relationName: 'taskflowCreator',
  }),
  taskLabels: many(taskflowTaskLabels),
  assignees: many(taskflowTaskAssignees),
  attachments: many(taskflowTaskAttachments),
  interventions: many(taskflowInterventions),
}));

export const taskflowTaskAssigneesRelations = relations(taskflowTaskAssignees, ({ one }) => ({
  task: one(taskflowTasks, {
    fields: [taskflowTaskAssignees.taskId],
    references: [taskflowTasks.id],
  }),
  user: one(users, {
    fields: [taskflowTaskAssignees.userId],
    references: [users.id],
    relationName: 'taskflowTaskAssigneeMember',
  }),
}));

export const taskflowTaskAttachmentsRelations = relations(taskflowTaskAttachments, ({ one }) => ({
  task: one(taskflowTasks, {
    fields: [taskflowTaskAttachments.taskId],
    references: [taskflowTasks.id],
  }),
  uploadedBy: one(users, {
    fields: [taskflowTaskAttachments.uploadedById],
    references: [users.id],
    relationName: 'taskflowAttachmentUploader',
  }),
}));

export const taskflowInterventionsRelations = relations(taskflowInterventions, ({ one }) => ({
  team: one(teams, {
    fields: [taskflowInterventions.teamId],
    references: [teams.id],
  }),
  task: one(taskflowTasks, {
    fields: [taskflowInterventions.taskId],
    references: [taskflowTasks.id],
  }),
  user: one(users, {
    fields: [taskflowInterventions.userId],
    references: [users.id],
  }),
}));

export const taskflowLabelsRelations = relations(taskflowLabels, ({ one, many }) => ({
  board: one(taskflowBoards, {
    fields: [taskflowLabels.boardId],
    references: [taskflowBoards.id],
  }),
  taskLabels: many(taskflowTaskLabels),
}));

export const taskflowTaskLabelsRelations = relations(taskflowTaskLabels, ({ one }) => ({
  task: one(taskflowTasks, {
    fields: [taskflowTaskLabels.taskId],
    references: [taskflowTasks.id],
  }),
  label: one(taskflowLabels, {
    fields: [taskflowTaskLabels.labelId],
    references: [taskflowLabels.id],
  }),
}));

export const taskflowAutomationRulesRelations = relations(
  taskflowAutomationRules,
  ({ one }) => ({
    team: one(teams, {
      fields: [taskflowAutomationRules.teamId],
      references: [teams.id],
    }),
  }),
);

export const projectusProjectsRelations = relations(projectusProjects, ({ one }) => ({
  team: one(teams, {
    fields: [projectusProjects.teamId],
    references: [teams.id],
  }),
}));

export const projectusPhasesRelations = relations(projectusPhases, ({ one, many }) => ({
  project: one(projectusProjects, {
    fields: [projectusPhases.projectId],
    references: [projectusProjects.id],
  }),
  tasks: many(projectusTasks),
}));

export const projectusTasksRelations = relations(projectusTasks, ({ one }) => ({
  project: one(projectusProjects, {
    fields: [projectusTasks.projectId],
    references: [projectusProjects.id],
  }),
  phase: one(projectusPhases, {
    fields: [projectusTasks.phaseId],
    references: [projectusPhases.id],
  }),
  assignee: one(users, {
    fields: [projectusTasks.assigneeId],
    references: [users.id],
  }),
}));

export const projectusMilestonesRelations = relations(projectusMilestones, ({ one }) => ({
  project: one(projectusProjects, {
    fields: [projectusMilestones.projectId],
    references: [projectusProjects.id],
  }),
}));

export const projectusRisksRelations = relations(projectusRisks, ({ one }) => ({
  project: one(projectusProjects, {
    fields: [projectusRisks.projectId],
    references: [projectusProjects.id],
  }),
  owner: one(users, {
    fields: [projectusRisks.ownerId],
    references: [users.id],
  }),
}));

export const projectusTaskDependenciesRelations = relations(
  projectusTaskDependencies,
  ({ one }) => ({
    task: one(projectusTasks, {
      fields: [projectusTaskDependencies.taskId],
      references: [projectusTasks.id],
    }),
    dependsOn: one(projectusTasks, {
      fields: [projectusTaskDependencies.dependsOnTaskId],
      references: [projectusTasks.id],
    }),
  }),
);

export const projectusCostCategoriesRelations = relations(projectusCostCategories, ({ one, many }) => ({
  team: one(teams, {
    fields: [projectusCostCategories.teamId],
    references: [teams.id],
  }),
  costItems: many(projectusCostItems),
}));

export const projectusCostItemsRelations = relations(projectusCostItems, ({ one }) => ({
  project: one(projectusProjects, {
    fields: [projectusCostItems.projectId],
    references: [projectusProjects.id],
  }),
  phase: one(projectusPhases, {
    fields: [projectusCostItems.phaseId],
    references: [projectusPhases.id],
  }),
  task: one(projectusTasks, {
    fields: [projectusCostItems.taskId],
    references: [projectusTasks.id],
  }),
  category: one(projectusCostCategories, {
    fields: [projectusCostItems.categoryId],
    references: [projectusCostCategories.id],
  }),
}));

export const taskflowAdvancedRulesRelations = relations(
  taskflowAdvancedRules,
  ({ one }) => ({
    team: one(teams, {
      fields: [taskflowAdvancedRules.teamId],
      references: [teams.id],
    }),
  }),
);

export const taskflowTaskEventsRelations = relations(taskflowTaskEvents, ({ one }) => ({
  task: one(taskflowTasks, {
    fields: [taskflowTaskEvents.taskId],
    references: [taskflowTasks.id],
  }),
}));

export const chronosAgendaItemsRelations = relations(chronosAgendaItems, ({ one }) => ({
  team: one(teams, {
    fields: [chronosAgendaItems.teamId],
    references: [teams.id],
  }),
  reunifyMeeting: one(reunifyMeetings, {
    fields: [chronosAgendaItems.reunifyMeetingId],
    references: [reunifyMeetings.id],
  }),
  participantUser: one(users, {
    fields: [chronosAgendaItems.participantUserId],
    references: [users.id],
  }),
}));

export const reunifyMeetingsRelations = relations(reunifyMeetings, ({ one, many }) => ({
  team: one(teams, {
    fields: [reunifyMeetings.teamId],
    references: [teams.id],
  }),
  captures: many(reunifyMeetingCaptures),
  participants: many(reunifyMeetingParticipants),
  canceledBy: one(users, {
    fields: [reunifyMeetings.canceledByUserId],
    references: [users.id],
    relationName: 'reunifyMeetingCanceledBy',
  }),
  rescheduledFrom: one(reunifyMeetings, {
    fields: [reunifyMeetings.rescheduledFromMeetingId],
    references: [reunifyMeetings.id],
    relationName: 'reunifyMeetingRescheduledFrom',
  }),
  rescheduledChildren: many(reunifyMeetings, {
    relationName: 'reunifyMeetingRescheduledFrom',
  }),
}));

export const reunifyMeetingParticipantsRelations = relations(
  reunifyMeetingParticipants,
  ({ one }) => ({
    meeting: one(reunifyMeetings, {
      fields: [reunifyMeetingParticipants.meetingId],
      references: [reunifyMeetings.id],
    }),
    team: one(teams, {
      fields: [reunifyMeetingParticipants.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [reunifyMeetingParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const reunifyMeetingCapturesRelations = relations(reunifyMeetingCaptures, ({ one }) => ({
  meeting: one(reunifyMeetings, {
    fields: [reunifyMeetingCaptures.meetingId],
    references: [reunifyMeetings.id],
  }),
  team: one(teams, {
    fields: [reunifyMeetingCaptures.teamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [reunifyMeetingCaptures.createdById],
    references: [users.id],
  }),
}));

export const reunifyAgendaItemsRelations = relations(reunifyAgendaItems, ({ one }) => ({
  meeting: one(reunifyMeetings, {
    fields: [reunifyAgendaItems.meetingId],
    references: [reunifyMeetings.id],
  }),
}));

export const reunifyDecisionsRelations = relations(reunifyDecisions, ({ one }) => ({
  meeting: one(reunifyMeetings, {
    fields: [reunifyDecisions.meetingId],
    references: [reunifyMeetings.id],
  }),
}));

export const reunifyActionItemsRelations = relations(reunifyActionItems, ({ one }) => ({
  meeting: one(reunifyMeetings, {
    fields: [reunifyActionItems.meetingId],
    references: [reunifyMeetings.id],
  }),
  owner: one(users, {
    fields: [reunifyActionItems.ownerId],
    references: [users.id],
  }),
  taskflowTask: one(taskflowTasks, {
    fields: [reunifyActionItems.taskflowTaskId],
    references: [taskflowTasks.id],
  }),
}));

export const bibliothecaDocumentsRelations = relations(bibliothecaDocuments, ({ one }) => ({
  team: one(teams, {
    fields: [bibliothecaDocuments.teamId],
    references: [teams.id],
  }),
  project: one(projectusProjects, {
    fields: [bibliothecaDocuments.projectId],
    references: [projectusProjects.id],
  }),
  task: one(taskflowTasks, {
    fields: [bibliothecaDocuments.taskId],
    references: [taskflowTasks.id],
  }),
  createdBy: one(users, {
    fields: [bibliothecaDocuments.createdById],
    references: [users.id],
  }),
}));

export const notepadNotesRelations = relations(notepadNotes, ({ one }) => ({
  team: one(teams, {
    fields: [notepadNotes.teamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [notepadNotes.createdById],
    references: [users.id],
  }),
  project: one(projectusProjects, {
    fields: [notepadNotes.projectId],
    references: [projectusProjects.id],
  }),
  task: one(taskflowTasks, {
    fields: [notepadNotes.taskId],
    references: [taskflowTasks.id],
  }),
  document: one(bibliothecaDocuments, {
    fields: [notepadNotes.documentId],
    references: [bibliothecaDocuments.id],
  }),
}));

export const scriptumProjectsRelations = relations(scriptumProjects, ({ one, many }) => ({
  team: one(teams, {
    fields: [scriptumProjects.teamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [scriptumProjects.createdById],
    references: [users.id],
  }),
  document: one(bibliothecaDocuments, {
    fields: [scriptumProjects.documentId],
    references: [bibliothecaDocuments.id],
  }),
  note: one(notepadNotes, {
    fields: [scriptumProjects.noteId],
    references: [notepadNotes.id],
  }),
  chapters: many(scriptumChapters),
}));

export const scriptumChaptersRelations = relations(scriptumChapters, ({ one }) => ({
  project: one(scriptumProjects, {
    fields: [scriptumChapters.projectId],
    references: [scriptumProjects.id],
  }),
}));

export const saasPlansRelations = relations(saasPlans, ({ many }) => ({
  modules: many(saasPlanModules),
  teamPlans: many(teamPlans),
}));

export const saasPlanModulesRelations = relations(saasPlanModules, ({ one }) => ({
  plan: one(saasPlans, {
    fields: [saasPlanModules.planId],
    references: [saasPlans.id],
  }),
}));

export const teamPlansRelations = relations(teamPlans, ({ one }) => ({
  team: one(teams, {
    fields: [teamPlans.teamId],
    references: [teams.id],
  }),
  plan: one(saasPlans, {
    fields: [teamPlans.planId],
    references: [saasPlans.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  team: one(teams, {
    fields: [auditEvents.teamId],
    references: [teams.id],
  }),
  actor: one(users, {
    fields: [auditEvents.actorUserId],
    references: [users.id],
  }),
}));

export const saasCustomerHealthRelations = relations(saasCustomerHealth, ({ one }) => ({
  team: one(teams, {
    fields: [saasCustomerHealth.teamId],
    references: [teams.id],
  }),
}));


export const resourcehubResourcesRelations = relations(resourcehubResources, ({ one, many }) => ({
  team: one(teams, {
    fields: [resourcehubResources.teamId],
    references: [teams.id],
  }),
  allocations: many(resourcehubAllocations),
  skills: many(resourcehubResourceSkills),
}));

export const resourcehubSkillsRelations = relations(resourcehubSkills, ({ many }) => ({
  resourceSkills: many(resourcehubResourceSkills),
}));

export const resourcehubResourceSkillsRelations = relations(
  resourcehubResourceSkills,
  ({ one }) => ({
    resource: one(resourcehubResources, {
      fields: [resourcehubResourceSkills.resourceId],
      references: [resourcehubResources.id],
    }),
    skill: one(resourcehubSkills, {
      fields: [resourcehubResourceSkills.skillId],
      references: [resourcehubSkills.id],
    }),
  }),
);

export const resourcehubAllocationsRelations = relations(resourcehubAllocations, ({ one }) => ({
  resource: one(resourcehubResources, {
    fields: [resourcehubAllocations.resourceId],
    references: [resourcehubResources.id],
  }),
  project: one(projectusProjects, {
    fields: [resourcehubAllocations.projectId],
    references: [projectusProjects.id],
  }),
  task: one(taskflowTasks, {
    fields: [resourcehubAllocations.taskId],
    references: [taskflowTasks.id],
  }),
}));

export const billtrakAccountsRelations = relations(billtrakAccounts, ({ one, many }) => ({
  team: one(teams, {
    fields: [billtrakAccounts.teamId],
    references: [teams.id],
  }),
  transactions: many(billtrakTransactions),
}));

export const billtrakCategoriesRelations = relations(billtrakCategories, ({ many }) => ({
  bills: many(billtrakBills),
}));

export const billtrakBillsRelations = relations(billtrakBills, ({ one, many }) => ({
  team: one(teams, {
    fields: [billtrakBills.teamId],
    references: [teams.id],
  }),
  category: one(billtrakCategories, {
    fields: [billtrakBills.categoryId],
    references: [billtrakCategories.id],
  }),
  project: one(projectusProjects, {
    fields: [billtrakBills.projectId],
    references: [projectusProjects.id],
  }),
  transactions: many(billtrakTransactions),
}));

export const billtrakTransactionsRelations = relations(billtrakTransactions, ({ one }) => ({
  team: one(teams, {
    fields: [billtrakTransactions.teamId],
    references: [teams.id],
  }),
  account: one(billtrakAccounts, {
    fields: [billtrakTransactions.accountId],
    references: [billtrakAccounts.id],
  }),
  bill: one(billtrakBills, {
    fields: [billtrakTransactions.billId],
    references: [billtrakBills.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type TaskflowBoard = typeof taskflowBoards.$inferSelect;
export type NewTaskflowBoard = typeof taskflowBoards.$inferInsert;
export type TaskflowColumn = typeof taskflowColumns.$inferSelect;
export type NewTaskflowColumn = typeof taskflowColumns.$inferInsert;
export type TaskflowStatusDefinition = typeof taskflowStatusDefinitions.$inferSelect;
export type NewTaskflowStatusDefinition = typeof taskflowStatusDefinitions.$inferInsert;
export type TaskflowTaskTypeDefinition = typeof taskflowTaskTypeDefinitions.$inferSelect;
export type NewTaskflowTaskTypeDefinition = typeof taskflowTaskTypeDefinitions.$inferInsert;
export type TaskflowTask = typeof taskflowTasks.$inferSelect;
export type NewTaskflowTask = typeof taskflowTasks.$inferInsert;
export type TaskflowLabel = typeof taskflowLabels.$inferSelect;
export type NewTaskflowLabel = typeof taskflowLabels.$inferInsert;
export type TaskflowTaskLabel = typeof taskflowTaskLabels.$inferSelect;
export type NewTaskflowTaskLabel = typeof taskflowTaskLabels.$inferInsert;
export type TaskflowAutomationRule = typeof taskflowAutomationRules.$inferSelect;
export type NewTaskflowAutomationRule = typeof taskflowAutomationRules.$inferInsert;
export type TaskflowAdvancedRule = typeof taskflowAdvancedRules.$inferSelect;
export type NewTaskflowAdvancedRule = typeof taskflowAdvancedRules.$inferInsert;
export type TaskflowTaskEvent = typeof taskflowTaskEvents.$inferSelect;
export type NewTaskflowTaskEvent = typeof taskflowTaskEvents.$inferInsert;
export type TaskflowDailyChecklist = typeof taskflowDailyChecklist.$inferSelect;
export type NewTaskflowDailyChecklist = typeof taskflowDailyChecklist.$inferInsert;
export type ProjectusProject = typeof projectusProjects.$inferSelect;
export type NewProjectusProject = typeof projectusProjects.$inferInsert;
export type ProjectusCostCategory = typeof projectusCostCategories.$inferSelect;
export type NewProjectusCostCategory = typeof projectusCostCategories.$inferInsert;
export type ProjectusCostItem = typeof projectusCostItems.$inferSelect;
export type NewProjectusCostItem = typeof projectusCostItems.$inferInsert;
export type ChronosAgendaItem = typeof chronosAgendaItems.$inferSelect;
export type NewChronosAgendaItem = typeof chronosAgendaItems.$inferInsert;
export type ReunifyMeeting = typeof reunifyMeetings.$inferSelect;
export type NewReunifyMeeting = typeof reunifyMeetings.$inferInsert;
export type ReunifyMeetingParticipant = typeof reunifyMeetingParticipants.$inferSelect;
export type NewReunifyMeetingParticipant = typeof reunifyMeetingParticipants.$inferInsert;
export type IntegrationSyncEvent = typeof integrationSyncEvents.$inferSelect;
export type NewIntegrationSyncEvent = typeof integrationSyncEvents.$inferInsert;
export type BibliothecaDocument = typeof bibliothecaDocuments.$inferSelect;
export type NewBibliothecaDocument = typeof bibliothecaDocuments.$inferInsert;
export type NotepadNote = typeof notepadNotes.$inferSelect;
export type NewNotepadNote = typeof notepadNotes.$inferInsert;
export type ScriptumProject = typeof scriptumProjects.$inferSelect;
export type NewScriptumProject = typeof scriptumProjects.$inferInsert;
export type ScriptumChapter = typeof scriptumChapters.$inferSelect;
export type NewScriptumChapter = typeof scriptumChapters.$inferInsert;
export type SaasPlan = typeof saasPlans.$inferSelect;
export type NewSaasPlan = typeof saasPlans.$inferInsert;
export type SaasPlanModule = typeof saasPlanModules.$inferSelect;
export type NewSaasPlanModule = typeof saasPlanModules.$inferInsert;
export type TeamPlan = typeof teamPlans.$inferSelect;
export type NewTeamPlan = typeof teamPlans.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type SaasCustomerHealth = typeof saasCustomerHealth.$inferSelect;
export type NewSaasCustomerHealth = typeof saasCustomerHealth.$inferInsert;
export type AiModel = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;
export type BilltrakAccount = typeof billtrakAccounts.$inferSelect;
export type NewBilltrakAccount = typeof billtrakAccounts.$inferInsert;
export type BilltrakCategory = typeof billtrakCategories.$inferSelect;
export type NewBilltrakCategory = typeof billtrakCategories.$inferInsert;
export type BilltrakBill = typeof billtrakBills.$inferSelect;
export type NewBilltrakBill = typeof billtrakBills.$inferInsert;
export type BilltrakTransaction = typeof billtrakTransactions.$inferSelect;
export type NewBilltrakTransaction = typeof billtrakTransactions.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  TASKFLOW_CREATE = 'TASKFLOW_CREATE',
  TASKFLOW_UPDATE = 'TASKFLOW_UPDATE',
  TASKFLOW_MOVE = 'TASKFLOW_MOVE',
  TASKFLOW_DELETE = 'TASKFLOW_DELETE',
  /** M6.7 — destinatário em `activity_logs.user_id` (responsável ≠ criador). */
  TASKFLOW_ASSIGNED = 'TASKFLOW_ASSIGNED',
  /** M7.1 — intervenção encerrada (timer). */
  TASKFLOW_INTERVENTION_STOP = 'TASKFLOW_INTERVENTION_STOP',
  /** M7.2 — intervenção registada manualmente (datas editáveis). */
  TASKFLOW_INTERVENTION_MANUAL = 'TASKFLOW_INTERVENTION_MANUAL',
  /** M7.3 — timer encerrado automaticamente por inatividade (sem resposta ao ping). */
  TASKFLOW_INTERVENTION_IDLE_AUTO = 'TASKFLOW_INTERVENTION_IDLE_AUTO',
  /** M7.5 — intervenção manual ou timer encerrado foi corrigida (datas ou texto). */
  TASKFLOW_INTERVENTION_EDIT = 'TASKFLOW_INTERVENTION_EDIT',
  /** M7.5 — intervenção removida (auditoria; impacto em horas/custos). */
  TASKFLOW_INTERVENTION_DELETE = 'TASKFLOW_INTERVENTION_DELETE',
  /** E8.7 — envio anónimo ao portal público (user_id nulo no log; IP opcional). */
  TASKFLOW_PORTAL_SUBMIT = 'TASKFLOW_PORTAL_SUBMIT',
  TASKFLOW_PORTAL_APPROVE = 'TASKFLOW_PORTAL_APPROVE',
  TASKFLOW_PORTAL_REJECT = 'TASKFLOW_PORTAL_REJECT',
  /** E8.8 — novo quadro criado a partir de estrutura de outro quadro do mesmo time. */
  TASKFLOW_BOARD_FROM_TEMPLATE = 'TASKFLOW_BOARD_FROM_TEMPLATE',
  /** E8.10 — ligação dev (commit/PR ou URL manual) associada a uma tarefa. */
  TASKFLOW_DEV_LINK_ADDED = 'TASKFLOW_DEV_LINK_ADDED',
}
