import { and, desc, eq, sql } from 'drizzle-orm';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db/drizzle';
import {
  billtrakAccounts,
  billtrakBills,
  billtrakTransactions,
  bibliothecaDocuments,
  chronosAgendaItems,
  notepadNotes,
  projectusPhases,
  projectusProjects,
  projectusTasks,
  resourcehubAllocations,
  resourcehubResources,
  reunifyActionItems,
  reunifyMeetings,
  scriptumChapters,
  scriptumProjects,
  taskflowBoards,
  taskflowColumns,
  taskflowStatusDefinitions,
  taskflowTaskAssignees,
  taskflowTasks,
  teamMembers,
  teams,
  users,
} from '@/lib/db/schema';

type ScenarioSummary = {
  runTag: string;
  generatedAt: string;
  team: { id: number; name: string };
  user: { id: number; email: string | null; name: string | null };
  inserts: Record<string, number>;
  dashboards: {
    taskflow: {
      totalTasks: number;
      openTasks: number;
      doneTasks: number;
    };
    reunify: {
      totalMeetings: number;
      scheduledMeetings: number;
      actionItems: number;
    };
    chronos: {
      totalAgendaItems: number;
    };
    billtrak: {
      accounts: number;
      bills: number;
      transactions: number;
      revenuesCents: number;
      expensesCents: number;
    };
    projectus: {
      projects: number;
      tasks: number;
    };
    resourcehub: {
      resources: number;
      allocations: number;
    };
    scriptum: {
      projects: number;
      chapters: number;
    };
    notepad: {
      notes: number;
    };
    bibliotheca: {
      documents: number;
    };
  };
};

function dateOnlyFromNow(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function nowTag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function modulo<T>(list: T[], index: number): T {
  return list[index % list.length];
}

async function getSeedContext() {
  const team = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.name, 'Time AtlasSwitch'))
    .limit(1);
  if (!team[0]) {
    throw new Error('Time "Time AtlasSwitch" nao encontrado. Rode `pnpm db:seed` antes.');
  }

  const ownerMembership = await db
    .select({
      userId: teamMembers.userId,
      email: users.email,
      name: users.name,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(and(eq(teamMembers.teamId, team[0].id), eq(teamMembers.role, 'owner')))
    .limit(1);
  if (!ownerMembership[0]) {
    throw new Error('Owner do time nao encontrado.');
  }

  return {
    team: team[0],
    user: {
      id: ownerMembership[0].userId,
      email: ownerMembership[0].email ?? null,
      name: ownerMembership[0].name ?? null,
    },
  };
}

async function ensureTaskflowBase(teamId: number, userId: number) {
  let board = await db
    .select({ id: taskflowBoards.id })
    .from(taskflowBoards)
    .where(eq(taskflowBoards.teamId, teamId))
    .orderBy(desc(taskflowBoards.id))
    .limit(1);

  if (!board[0]) {
    board = await db
      .insert(taskflowBoards)
      .values({
        teamId,
        name: 'Quadro QA Automacao',
        description: 'Quadro criado para testes automatizados.',
      })
      .returning({ id: taskflowBoards.id });
  }

  let columns = await db
    .select({ id: taskflowColumns.id, phaseType: taskflowColumns.phaseType })
    .from(taskflowColumns)
    .where(eq(taskflowColumns.boardId, board[0].id))
    .orderBy(taskflowColumns.position);

  if (columns.length < 3) {
    await db.insert(taskflowColumns).values([
      { boardId: board[0].id, name: 'Entrada', phaseType: 'INITIAL', position: 0 },
      { boardId: board[0].id, name: 'Execucao', phaseType: 'PRODUCTION', position: 1 },
      { boardId: board[0].id, name: 'Concluido', phaseType: 'FINAL', position: 2 },
    ]);
    columns = await db
      .select({ id: taskflowColumns.id, phaseType: taskflowColumns.phaseType })
      .from(taskflowColumns)
      .where(eq(taskflowColumns.boardId, board[0].id))
      .orderBy(taskflowColumns.position);
  }

  let statuses = await db
    .select({ id: taskflowStatusDefinitions.id, fixedSituation: taskflowStatusDefinitions.fixedSituation })
    .from(taskflowStatusDefinitions)
    .where(eq(taskflowStatusDefinitions.teamId, teamId))
    .orderBy(taskflowStatusDefinitions.position);

  if (statuses.length === 0) {
    await db.insert(taskflowStatusDefinitions).values([
      { teamId, code: 'OPEN', name: 'Aberto', fixedSituation: 'OPEN', color: 'slate', position: 0 },
      { teamId, code: 'IN_PROGRESS', name: 'Em progresso', fixedSituation: 'OPEN', color: 'indigo', position: 1 },
      { teamId, code: 'DONE', name: 'Concluido', fixedSituation: 'DONE', color: 'emerald', position: 2 },
      { teamId, code: 'CANCELLED', name: 'Cancelado', fixedSituation: 'CANCELLED', color: 'rose', position: 3 },
    ]);
    statuses = await db
      .select({ id: taskflowStatusDefinitions.id, fixedSituation: taskflowStatusDefinitions.fixedSituation })
      .from(taskflowStatusDefinitions)
      .where(eq(taskflowStatusDefinitions.teamId, teamId))
      .orderBy(taskflowStatusDefinitions.position);
  }

  const openStatus = statuses.find((s) => s.fixedSituation === 'OPEN') ?? statuses[0];
  const doneStatus = statuses.find((s) => s.fixedSituation === 'DONE') ?? statuses[0];
  const initialColumn = columns.find((c) => c.phaseType === 'INITIAL') ?? columns[0];
  const productionColumn = columns.find((c) => c.phaseType === 'PRODUCTION') ?? columns[0];
  const finalColumn = columns.find((c) => c.phaseType === 'FINAL') ?? columns[columns.length - 1];

  return {
    boardId: board[0].id,
    userId,
    openStatusId: openStatus.id,
    doneStatusId: doneStatus.id,
    initialColumnId: initialColumn.id,
    productionColumnId: productionColumn.id,
    finalColumnId: finalColumn.id,
  };
}

async function runScenario() {
  const runTag = `QA-AUTO-${nowTag()}`;
  const context = await getSeedContext();
  const { team, user } = context;
  const taskflowBase = await ensureTaskflowBase(team.id, user.id);

  const inserts: Record<string, number> = {};

  // Projectus
  const createdProjects = await db
    .insert(projectusProjects)
    .values(
      Array.from({ length: 6 }).map((_, i) => ({
        teamId: team.id,
        name: `${runTag} Projeto ${i + 1}`,
        status: i % 4 === 0 ? 'CONCLUIDO' : 'EM_ANDAMENTO',
        dueDate: new Date(`${dateOnlyFromNow(7 + i)}T12:00:00.000Z`),
        budgetCents: 500000 + i * 45000,
      })),
    )
    .returning({ id: projectusProjects.id });
  inserts.projectusProjects = createdProjects.length;

  const createdPhases: Array<{ id: number; projectId: number }> = [];
  for (const [idx, p] of createdProjects.entries()) {
    const phases = await db
      .insert(projectusPhases)
      .values([
        {
          projectId: p.id,
          name: `${runTag} Planejamento ${idx + 1}`,
          status: 'EM_ANDAMENTO',
          position: 0,
          startDate: dateOnlyFromNow(-3),
          endDate: dateOnlyFromNow(4),
        },
        {
          projectId: p.id,
          name: `${runTag} Entrega ${idx + 1}`,
          status: 'PLANEJADA',
          position: 1,
          startDate: dateOnlyFromNow(5),
          endDate: dateOnlyFromNow(12),
        },
      ])
      .returning({ id: projectusPhases.id, projectId: projectusPhases.projectId });
    createdPhases.push(...phases);
  }
  inserts.projectusPhases = createdPhases.length;

  const createdProjectusTasks = await db
    .insert(projectusTasks)
    .values(
      Array.from({ length: 24 }).map((_, i) => ({
        projectId: modulo(createdProjects, i).id,
        phaseId: modulo(createdPhases.filter((p) => p.projectId === modulo(createdProjects, i).id), i).id,
        title: `${runTag} Task Projectus ${i + 1}`,
        description: 'Gerada automaticamente para validacao de dashboards.',
        assigneeId: user.id,
        status: i % 3 === 0 ? 'CONCLUIDA' : 'ABERTA',
        priority: i % 4 === 0 ? 'ALTA' : 'MEDIA',
        startDate: dateOnlyFromNow(-(i % 5)),
        dueDate: dateOnlyFromNow(4 + (i % 8)),
        effortHours: 2 + (i % 6),
        progress: i % 3 === 0 ? 100 : 40,
      })),
    )
    .returning({ id: projectusTasks.id });
  inserts.projectusTasks = createdProjectusTasks.length;

  // Taskflow
  const createdTaskflowTasks = await db
    .insert(taskflowTasks)
    .values(
      Array.from({ length: 42 }).map((_, i) => {
        const closed = i % 5 === 0;
        return {
          boardId: taskflowBase.boardId,
          columnId: closed
            ? taskflowBase.finalColumnId
            : i % 2 === 0
              ? taskflowBase.productionColumnId
              : taskflowBase.initialColumnId,
          projectId: modulo(createdProjects, i).id,
          title: `${runTag} Tarefa Taskflow ${i + 1}`,
          description: 'Carga automatizada para teste funcional transversal.',
          taskType: 'generic',
          priority: i % 4 === 0 ? 'HIGH' : 'MEDIUM',
          statusId: closed ? taskflowBase.doneStatusId : taskflowBase.openStatusId,
          position: i,
          dueDate: new Date(`${dateOnlyFromNow((i % 10) - 2)}T15:00:00.000Z`),
          plannedStartAt: new Date(`${dateOnlyFromNow(-(i % 6))}T09:00:00.000Z`),
          estimatedDurationHours: 1 + (i % 7),
          assigneeId: user.id,
          createdById: user.id,
        };
      }),
    )
    .returning({ id: taskflowTasks.id });
  inserts.taskflowTasks = createdTaskflowTasks.length;

  const taskAssignees = await db
    .insert(taskflowTaskAssignees)
    .values(
      createdTaskflowTasks.map((t, i) => ({
        taskId: t.id,
        userId: user.id,
        position: i,
      })),
    )
    .returning({ id: taskflowTaskAssignees.id });
  inserts.taskflowTaskAssignees = taskAssignees.length;

  // Reunify + Chronos
  const createdMeetings = await db
    .insert(reunifyMeetings)
    .values(
      Array.from({ length: 14 }).map((_, i) => ({
        teamId: team.id,
        date: dateOnlyFromNow(i - 2),
        startTime: i % 2 === 0 ? '09:00' : '14:00',
        endTime: i % 2 === 0 ? '10:00' : '15:00',
        durationMinutes: 60,
        title: `${runTag} Reuniao ${i + 1}`,
        status: i % 4 === 0 ? 'FINALIZADA' : 'AGENDADA',
        location: 'Sala integrada',
        summary: 'Reuniao automatica para teste de operacao.',
      })),
    )
    .returning({ id: reunifyMeetings.id, status: reunifyMeetings.status, title: reunifyMeetings.title });
  inserts.reunifyMeetings = createdMeetings.length;

  const createdActionItems = await db
    .insert(reunifyActionItems)
    .values(
      createdMeetings.slice(0, 10).map((m, i) => ({
        meetingId: m.id,
        title: `${runTag} Acao reuniao ${i + 1}`,
        ownerId: user.id,
        dueDate: dateOnlyFromNow(2 + i),
        status: i % 3 === 0 ? 'CONCLUIDO' : 'ABERTO',
        notes: 'Acao automatica para teste.',
      })),
    )
    .returning({ id: reunifyActionItems.id });
  inserts.reunifyActionItems = createdActionItems.length;

  const chronosRows = await db
    .insert(chronosAgendaItems)
    .values(
      Array.from({ length: 24 }).map((_, i) => ({
        teamId: team.id,
        date: dateOnlyFromNow(i - 3),
        startTime: i % 2 === 0 ? '08:00' : '16:00',
        endTime: i % 2 === 0 ? '09:00' : '17:00',
        durationMinutes: 60,
        title: `${runTag} Agenda ${i + 1}`,
        description: 'Compromisso gerado para testar visao de agenda.',
        type: i % 3 === 0 ? 'REUNIAO' : 'FOCO',
        location: 'Atlas HQ',
        source: i % 4 === 0 ? 'REUNIFY' : 'MANUAL',
        status: i % 5 === 0 ? 'CONCLUIDO' : 'AGENDADO',
        reunifyMeetingId: i < createdMeetings.length ? createdMeetings[i].id : null,
      })),
    )
    .returning({ id: chronosAgendaItems.id });
  inserts.chronosAgendaItems = chronosRows.length;

  // Billtrak
  const accounts = await db
    .insert(billtrakAccounts)
    .values(
      Array.from({ length: 4 }).map((_, i) => ({
        teamId: team.id,
        name: `${runTag} Conta ${i + 1}`,
        type: i % 2 === 0 ? 'CORRENTE' : 'CAIXA',
        balanceCents: 200000 + i * 120000,
      })),
    )
    .returning({ id: billtrakAccounts.id });
  inserts.billtrakAccounts = accounts.length;

  const bills = await db
    .insert(billtrakBills)
    .values(
      Array.from({ length: 18 }).map((_, i) => ({
        teamId: team.id,
        title: `${runTag} Lancamento ${i + 1}`,
        projectId: modulo(createdProjects, i).id,
        status: i % 3 === 0 ? 'PAGO' : 'PENDENTE',
        amountCents: 15000 + i * 3000,
        dueDate: dateOnlyFromNow(i - 4),
        recurring: i % 5 === 0,
      })),
    )
    .returning({ id: billtrakBills.id });
  inserts.billtrakBills = bills.length;

  const transactions = await db
    .insert(billtrakTransactions)
    .values(
      Array.from({ length: 28 }).map((_, i) => ({
        teamId: team.id,
        accountId: modulo(accounts, i).id,
        billId: i < bills.length ? bills[i].id : null,
        type: i % 4 === 0 ? 'CREDITO' : 'DEBITO',
        description: `${runTag} Mov ${i + 1}`,
        amountCents: 9000 + i * 1500,
        occurredAt: dateOnlyFromNow(-(i % 9)),
      })),
    )
    .returning({ id: billtrakTransactions.id });
  inserts.billtrakTransactions = transactions.length;

  // ResourceHub
  const resources = await db
    .insert(resourcehubResources)
    .values(
      Array.from({ length: 12 }).map((_, i) => ({
        teamId: team.id,
        name: `${runTag} Recurso ${i + 1}`,
        type: i % 3 === 0 ? 'PESSOA' : i % 3 === 1 ? 'EQUIPAMENTO' : 'ESPACO',
        status: i % 5 === 0 ? 'PAUSADO' : 'DISPONIVEL',
        capacityHoursPerWeek: 20 + (i % 4) * 10,
        costRateCents: 7000 + i * 350,
      })),
    )
    .returning({ id: resourcehubResources.id });
  inserts.resourcehubResources = resources.length;

  const allocations = await db
    .insert(resourcehubAllocations)
    .values(
      Array.from({ length: 22 }).map((_, i) => ({
        resourceId: modulo(resources, i).id,
        projectId: modulo(createdProjects, i).id,
        taskId: i < createdTaskflowTasks.length ? createdTaskflowTasks[i].id : null,
        startDate: dateOnlyFromNow(-(i % 4)),
        endDate: dateOnlyFromNow(7 + (i % 5)),
        hoursPerWeek: 4 + (i % 6) * 2,
        status: i % 4 === 0 ? 'PAUSADO' : 'ATIVO',
      })),
    )
    .returning({ id: resourcehubAllocations.id });
  inserts.resourcehubAllocations = allocations.length;

  // Notepad / Bibliotheca / Scriptum
  const docs = await db
    .insert(bibliothecaDocuments)
    .values(
      Array.from({ length: 18 }).map((_, i) => ({
        teamId: team.id,
        projectId: modulo(createdProjects, i).id,
        taskId: i < createdTaskflowTasks.length ? createdTaskflowTasks[i].id : null,
        createdById: user.id,
        title: `${runTag} Documento ${i + 1}`,
        category: i % 2 === 0 ? 'Pesquisa' : 'Operacao',
        size: `${1 + (i % 6)}.0 MB`,
        status: i % 5 === 0 ? 'ARQUIVADO' : 'ATIVO',
        visibility: 'EQUIPE',
        source: 'UPLOAD',
      })),
    )
    .returning({ id: bibliothecaDocuments.id });
  inserts.bibliothecaDocuments = docs.length;

  const notes = await db
    .insert(notepadNotes)
    .values(
      Array.from({ length: 24 }).map((_, i) => ({
        teamId: team.id,
        createdById: user.id,
        projectId: modulo(createdProjects, i).id,
        taskId: i < createdTaskflowTasks.length ? createdTaskflowTasks[i].id : null,
        documentId: i < docs.length ? docs[i].id : null,
        title: `${runTag} Nota ${i + 1}`,
        content: 'Nota gerada automaticamente para teste de listagem e filtros.',
        folder: i % 2 === 0 ? 'Geral' : 'Planejamento',
        status: i % 7 === 0 ? 'ARQUIVADA' : 'ATIVA',
        visibility: 'EQUIPE',
        pinned: i % 6 === 0,
        source: 'MANUAL',
      })),
    )
    .returning({ id: notepadNotes.id });
  inserts.notepadNotes = notes.length;

  const writingProjects = await db
    .insert(scriptumProjects)
    .values(
      Array.from({ length: 10 }).map((_, i) => ({
        teamId: team.id,
        createdById: user.id,
        documentId: i < docs.length ? docs[i].id : null,
        noteId: i < notes.length ? notes[i].id : null,
        title: `${runTag} Escrita ${i + 1}`,
        type: i % 2 === 0 ? 'ARTIGO' : 'ROTEIRO',
        status: i % 3 === 0 ? 'REVISAO' : 'RASCUNHO',
        goalWords: 1200 + i * 200,
        currentWords: 300 + i * 90,
        dueDate: dateOnlyFromNow(10 + i),
      })),
    )
    .returning({ id: scriptumProjects.id });
  inserts.scriptumProjects = writingProjects.length;

  const chapters = await db
    .insert(scriptumChapters)
    .values(
      Array.from({ length: 30 }).map((_, i) => ({
        projectId: modulo(writingProjects, i).id,
        title: `${runTag} Capitulo ${i + 1}`,
        status: i % 4 === 0 ? 'CONCLUIDO' : 'EM_PROGRESSO',
        wordCount: 350 + i * 20,
        position: i + 1,
      })),
    )
    .returning({ id: scriptumChapters.id });
  inserts.scriptumChapters = chapters.length;

  // Totais de dashboard
  const [taskflowStats] = await db.execute(sql`
    select
      count(*)::int as total_tasks,
      count(*) filter (where tsd.fixed_situation = 'OPEN')::int as open_tasks,
      count(*) filter (where tsd.fixed_situation = 'DONE')::int as done_tasks
    from taskflow_tasks t
    join taskflow_status_definitions tsd on tsd.id = t.status_id
    join taskflow_boards b on b.id = t.board_id
    where b.team_id = ${team.id}
  `);

  const [reunifyStats] = await db.execute(sql`
    select
      count(*)::int as total_meetings,
      count(*) filter (where status = 'AGENDADA')::int as scheduled_meetings
    from reunify_meetings
    where team_id = ${team.id}
  `);

  const [actionStats] = await db.execute(sql`
    select count(*)::int as action_items
    from reunify_action_items rai
    join reunify_meetings rm on rm.id = rai.meeting_id
    where rm.team_id = ${team.id}
  `);

  const [chronosStats] = await db.execute(sql`
    select count(*)::int as total_agenda_items
    from chronos_agenda_items
    where team_id = ${team.id}
  `);

  const [billStats] = await db.execute(sql`
    select
      (select count(*)::int from billtrak_accounts where team_id = ${team.id}) as accounts,
      (select count(*)::int from billtrak_bills where team_id = ${team.id}) as bills,
      (select count(*)::int from billtrak_transactions where team_id = ${team.id}) as transactions,
      (select coalesce(sum(amount_cents), 0)::int from billtrak_transactions where team_id = ${team.id} and type = 'CREDITO') as revenues_cents,
      (select coalesce(sum(amount_cents), 0)::int from billtrak_transactions where team_id = ${team.id} and type = 'DEBITO') as expenses_cents
  `);

  const [projectusStats] = await db.execute(sql`
    select
      (select count(*)::int from projectus_projects where team_id = ${team.id}) as projects,
      (select count(*)::int from projectus_tasks pt join projectus_projects pp on pp.id = pt.project_id where pp.team_id = ${team.id}) as tasks
  `);

  const [resourcehubStats] = await db.execute(sql`
    select
      (select count(*)::int from resourcehub_resources where team_id = ${team.id}) as resources,
      (select count(*)::int from resourcehub_allocations ra join resourcehub_resources rr on rr.id = ra.resource_id where rr.team_id = ${team.id}) as allocations
  `);

  const [scriptumStats] = await db.execute(sql`
    select
      (select count(*)::int from scriptum_projects where team_id = ${team.id}) as projects,
      (select count(*)::int from scriptum_chapters sc join scriptum_projects sp on sp.id = sc.project_id where sp.team_id = ${team.id}) as chapters
  `);

  const [noteStats] = await db.execute(sql`
    select count(*)::int as notes from notepad_notes where team_id = ${team.id}
  `);

  const [docStats] = await db.execute(sql`
    select count(*)::int as documents from bibliotheca_documents where team_id = ${team.id}
  `);

  const summary: ScenarioSummary = {
    runTag,
    generatedAt: new Date().toISOString(),
    team,
    user,
    inserts,
    dashboards: {
      taskflow: {
        totalTasks: Number((taskflowStats as any).total_tasks ?? 0),
        openTasks: Number((taskflowStats as any).open_tasks ?? 0),
        doneTasks: Number((taskflowStats as any).done_tasks ?? 0),
      },
      reunify: {
        totalMeetings: Number((reunifyStats as any).total_meetings ?? 0),
        scheduledMeetings: Number((reunifyStats as any).scheduled_meetings ?? 0),
        actionItems: Number((actionStats as any).action_items ?? 0),
      },
      chronos: {
        totalAgendaItems: Number((chronosStats as any).total_agenda_items ?? 0),
      },
      billtrak: {
        accounts: Number((billStats as any).accounts ?? 0),
        bills: Number((billStats as any).bills ?? 0),
        transactions: Number((billStats as any).transactions ?? 0),
        revenuesCents: Number((billStats as any).revenues_cents ?? 0),
        expensesCents: Number((billStats as any).expenses_cents ?? 0),
      },
      projectus: {
        projects: Number((projectusStats as any).projects ?? 0),
        tasks: Number((projectusStats as any).tasks ?? 0),
      },
      resourcehub: {
        resources: Number((resourcehubStats as any).resources ?? 0),
        allocations: Number((resourcehubStats as any).allocations ?? 0),
      },
      scriptum: {
        projects: Number((scriptumStats as any).projects ?? 0),
        chapters: Number((scriptumStats as any).chapters ?? 0),
      },
      notepad: {
        notes: Number((noteStats as any).notes ?? 0),
      },
      bibliotheca: {
        documents: Number((docStats as any).documents ?? 0),
      },
    },
  };

  const reportDir = path.join(process.cwd(), 'Projeto', 'registos-qa');
  const jsonPath = path.join(reportDir, `qa-operacional-${runTag}.json`);
  const mdPath = path.join(reportDir, `qa-operacional-${runTag}.md`);
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    jsonPath,
    JSON.stringify(summary, null, 2),
    'utf-8',
  );

  const markdown = `# Registo QA automatizado (${runTag})

Gerado em: ${summary.generatedAt}
Time: ${summary.team.name} (id ${summary.team.id})
Operador base: ${summary.user.email ?? 'sem-email'} (id ${summary.user.id})

## Inserts desta execucao

${Object.entries(summary.inserts)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

## Snapshot de dashboards

- Taskflow: total ${summary.dashboards.taskflow.totalTasks}, abertas ${summary.dashboards.taskflow.openTasks}, concluidas ${summary.dashboards.taskflow.doneTasks}
- Reunify: reunioes ${summary.dashboards.reunify.totalMeetings}, agendadas ${summary.dashboards.reunify.scheduledMeetings}, acoes ${summary.dashboards.reunify.actionItems}
- Chronos: itens de agenda ${summary.dashboards.chronos.totalAgendaItems}
- Billtrak: contas ${summary.dashboards.billtrak.accounts}, lancamentos ${summary.dashboards.billtrak.bills}, transacoes ${summary.dashboards.billtrak.transactions}
- Projectus: projetos ${summary.dashboards.projectus.projects}, tarefas ${summary.dashboards.projectus.tasks}
- ResourceHub: recursos ${summary.dashboards.resourcehub.resources}, alocacoes ${summary.dashboards.resourcehub.allocations}
- Scriptum: projetos ${summary.dashboards.scriptum.projects}, capitulos ${summary.dashboards.scriptum.chapters}
- Notepad: notas ${summary.dashboards.notepad.notes}
- Bibliotheca: documentos ${summary.dashboards.bibliotheca.documents}

## Artefatos

- JSON: \`Projeto/registos-qa/qa-operacional-${runTag}.json\`
- Markdown: \`Projeto/registos-qa/qa-operacional-${runTag}.md\`
`;
  await writeFile(mdPath, markdown, 'utf-8');

  console.log(`[qa:scenario] Run ${runTag} concluido.`);
  console.log(`[qa:scenario] Relatorio JSON: ${jsonPath}`);
  console.log(`[qa:scenario] Relatorio Markdown: ${mdPath}`);
}

runScenario()
  .catch((error) => {
    console.error('[qa:scenario] Falha:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
