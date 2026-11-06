import { ensureStripeClient } from '../payments/stripe';
import { db } from './drizzle';
import { and, eq } from 'drizzle-orm';
import {
  users,
  teams,
  teamMembers,
  chronosAgendaItems,
  reunifyMeetings,
  reunifyAgendaItems,
  reunifyDecisions,
  reunifyActionItems,
  bibliothecaDocuments,
  notepadNotes,
  scriptumProjects,
  scriptumChapters,
  saasPlans,
  saasPlanModules,
  teamPlans,
  auditEvents,
  saasCustomerHealth,
  aiModels,
  projectusProjects,
  projectusPhases,
  projectusTasks,
  projectusMilestones,
  projectusRisks,
  projectusTaskDependencies,
  projectusCostCategories,
  projectusCostItems,
  resourcehubResources,
  resourcehubSkills,
  resourcehubResourceSkills,
  resourcehubAllocations,
  billtrakAccounts,
  billtrakCategories,
  billtrakBills,
  billtrakTransactions,
} from './schema';
import { ensurePlatformSettingsDefaults } from './platform-settings';
import { hashPassword } from '@/lib/auth/session';
import { ensureProjectusCostCategories } from '@/lib/projectus/ensure-cost-categories';

const toDateString = (value: Date) => value.toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

async function createStripeProducts() {
  if (process.env.STRIPE_ENABLED !== 'true' || !process.env.STRIPE_SECRET_KEY) {
    console.log('Stripe desativado. Pulando criação de produtos.');
    return;
  }

  const stripe = ensureStripeClient();
  console.log('Criando produtos e preços no Stripe...');

  const baseProduct = await stripe.products.create({
    name: 'Essencial',
    description: 'Plano de assinatura Essencial',
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800, // R$ 8,00 em centavos
    currency: 'brl',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  const plusProduct = await stripe.products.create({
    name: 'Pro',
    description: 'Plano de assinatura Pro',
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200, // R$ 12,00 em centavos
    currency: 'brl',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  console.log('Produtos e preços do Stripe criados com sucesso.');
}

async function seed() {
  const email = 'teste@atlatswitch.com';
  const password = 'Admin@123';
  const passwordHash = await hashPassword(password);

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user = existingUser[0];
  if (!user) {
    ;[user] = await db
      .insert(users)
      .values([
        {
          email: email,
          name: 'Administrador seed',
          passwordHash: passwordHash,
          /** Operador da instância — único papel com Centro de Controlo global (ver `canAccessControlPlane`). */
          role: 'platform_admin',
        },
      ])
      .returning();
  } else if (existingUser[0].role !== 'platform_admin') {
    await db.update(users).set({ role: 'platform_admin' }).where(eq(users.email, email));
    user = { ...existingUser[0], role: 'platform_admin' };
  }

  console.log('Usuário inicial criado (platform_admin).');

  const existingTeam = await db
    .select()
    .from(teams)
    .where(eq(teams.name, 'Time AtlasSwitch'))
    .limit(1);

  const team =
    existingTeam[0] ||
    (
      await db
        .insert(teams)
        .values({
          name: 'Time AtlasSwitch',
        })
        .returning()
    )[0];

  const existingMembership = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (!existingMembership[0]) {
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: 'owner',
    });
  }

  await ensurePlatformSettingsDefaults();

  const hasChronos = await db
    .select()
    .from(chronosAgendaItems)
    .where(eq(chronosAgendaItems.teamId, team.id))
    .limit(1);

  if (!hasChronos[0]) {
    await db.insert(chronosAgendaItems).values([
      {
        teamId: team.id,
        date: toDateString(new Date()),
        startTime: '08:30',
        endTime: '10:00',
        durationMinutes: 90,
        title: 'Aula de Sistemas',
        description: 'Revisão dos tópicos principais.',
        type: 'PESSOAL',
        location: 'Sala 101',
        reminderMinutes: 15,
        recurrence: 'WEEKLY',
        timezone: 'America/Sao_Paulo',
        source: 'MANUAL',
        status: 'AGENDADO',
      },
      {
        teamId: team.id,
        date: toDateString(new Date()),
        startTime: '10:00',
        endTime: '12:00',
        durationMinutes: 120,
        title: 'Bloco de foco: TCC',
        description: 'Pesquisa e escrita estruturada.',
        type: 'FOCO',
        location: 'Biblioteca',
        reminderMinutes: 10,
        recurrence: 'DAILY',
        timezone: 'America/Sao_Paulo',
        source: 'MANUAL',
        status: 'AGENDADO',
      },
      {
        teamId: team.id,
        date: toDateString(new Date()),
        startTime: '14:00',
        endTime: '15:00',
        durationMinutes: 60,
        title: 'Reunião de equipe',
        description: 'Alinhamento de sprint.',
        type: 'REUNIAO',
        location: 'Sala de reuniões',
        reminderMinutes: 30,
        recurrence: 'NONE',
        timezone: 'America/Sao_Paulo',
        source: 'REUNIFY',
        status: 'AGENDADO',
      },
    ]);
  }

  const hasMeetings = await db
    .select()
    .from(reunifyMeetings)
    .where(eq(reunifyMeetings.teamId, team.id))
    .limit(1);

  if (!hasMeetings[0]) {
    const meetings = await db.insert(reunifyMeetings).values([
      {
        teamId: team.id,
        date: toDateString(new Date()),
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        title: 'Kickoff de projeto',
        status: 'FINALIZADA',
        location: 'Sala 2',
        summary: 'Definição de metas e próximos passos.',
      },
      {
        teamId: team.id,
        date: toDateString(new Date()),
        startTime: '13:30',
        endTime: '14:15',
        durationMinutes: 45,
        title: 'Alinhamento semanal',
        status: 'EM_ANDAMENTO',
        location: 'Sala 1',
        summary: 'Acompanhamento das entregas críticas.',
      },
      {
        teamId: team.id,
        date: toDateString(new Date()),
        startTime: '17:00',
        endTime: '18:00',
        durationMinutes: 60,
        title: 'Pauta colaborativa - laboratório',
        status: 'AGENDADA',
        location: 'Sala 3',
        summary: 'Preparar pauta de decisões para laboratório.',
      },
    ]).returning();

    const baseMeeting = meetings[0];
    if (baseMeeting) {
      await db.insert(reunifyAgendaItems).values([
        {
          meetingId: baseMeeting.id,
          title: 'Contexto do projeto',
          owner: 'Coordenação',
          durationMinutes: 10,
          status: 'ABERTO',
          position: 1,
        },
        {
          meetingId: baseMeeting.id,
          title: 'Definir marcos',
          owner: 'PM',
          durationMinutes: 20,
          status: 'ABERTO',
          position: 2,
        },
      ]);

      await db.insert(reunifyDecisions).values([
        {
          meetingId: baseMeeting.id,
          title: 'Aprovar cronograma inicial',
          owner: 'Diretoria',
          decidedAt: new Date(),
        },
      ]);

      await db.insert(reunifyActionItems).values([
        {
          meetingId: baseMeeting.id,
          title: 'Enviar plano de entregas',
          ownerId: user.id,
          dueDate: toDateString(addDays(2)),
          status: 'ABERTO',
          notes: 'Compartilhar com stakeholders.',
        },
      ]);
    }
  }

  const hasDocs = await db
    .select()
    .from(bibliothecaDocuments)
    .where(eq(bibliothecaDocuments.teamId, team.id))
    .limit(1);

  if (!hasDocs[0]) {
    await db.insert(bibliothecaDocuments).values([
      {
        teamId: team.id,
        createdById: user.id,
        title: 'Artigo - IA aplicada',
        category: 'Pesquisa',
        size: '4.2 MB',
        status: 'ATIVO',
        visibility: 'EQUIPE',
        tags: 'ia, pesquisa, universidade',
        description: 'Material base para revisão bibliográfica.',
        source: 'UPLOAD',
      },
      {
        teamId: team.id,
        createdById: user.id,
        title: 'Contrato de parceria',
        category: 'Jurídico',
        size: '1.1 MB',
        status: 'ATIVO',
        visibility: 'GESTAO',
        tags: 'contrato, juridico, parceiro',
        description: 'Acordo institucional com cláusulas de vigência.',
        source: 'UPLOAD',
      },
      {
        teamId: team.id,
        createdById: user.id,
        title: 'Relatório de sprint',
        category: 'Projetos',
        size: '2.6 MB',
        status: 'ATIVO',
        visibility: 'EQUIPE',
        tags: 'projeto, sprint, entregas',
        description: 'Resumo das entregas e próximos passos.',
        source: 'UPLOAD',
      },
    ]);
  }

  const hasNotes = await db
    .select()
    .from(notepadNotes)
    .where(eq(notepadNotes.teamId, team.id))
    .limit(1);

  if (!hasNotes[0]) {
    await db.insert(notepadNotes).values([
      {
        teamId: team.id,
        createdById: user.id,
        title: 'Resumo de aula - IA aplicada',
        content: 'Principais conceitos: redes neurais, embeddings e busca semântica.',
        folder: 'Universidade',
        tags: 'ia, aula, resumo',
        status: 'ATIVA',
        visibility: 'EQUIPE',
        pinned: true,
        source: 'MANUAL',
      },
      {
        teamId: team.id,
        createdById: user.id,
        title: 'Ideias para projeto final',
        content: 'Conectar Bibliotheca com Notepad para referências cruzadas.',
        folder: 'Projetos',
        tags: 'projeto, ideias',
        status: 'ATIVA',
        visibility: 'EQUIPE',
        pinned: false,
        source: 'MANUAL',
      },
      {
        teamId: team.id,
        createdById: user.id,
        title: 'Checklist de pesquisa',
        content: '- Revisar artigos\n- Atualizar referências\n- Esboçar metodologia',
        folder: 'Pessoal',
        tags: 'pesquisa, checklist',
        status: 'ATIVA',
        visibility: 'PESSOAL',
        pinned: false,
        source: 'MANUAL',
      },
    ]);
  }

  const hasScriptum = await db
    .select()
    .from(scriptumProjects)
    .where(eq(scriptumProjects.teamId, team.id))
    .limit(1);

  if (!hasScriptum[0]) {
    const insertedProjects = await db
      .insert(scriptumProjects)
      .values([
        {
          teamId: team.id,
          createdById: user.id,
          title: 'Tese - Capítulo 3',
          type: 'TESE',
          status: 'REVISAO',
          goalWords: 1200,
          currentWords: 860,
          dueDate: toDateString(addDays(10)),
          summary: 'Capítulo sobre metodologia e resultados iniciais.',
        },
        {
          teamId: team.id,
          createdById: user.id,
          title: 'Roteiro curto',
          type: 'ROTEIRO',
          status: 'RASCUNHO',
          goalWords: 800,
          currentWords: 320,
          dueDate: toDateString(addDays(5)),
          summary: 'Roteiro para curta universitário.',
        },
      ])
      .returning();

    if (insertedProjects[0]) {
      await db.insert(scriptumChapters).values([
        {
          projectId: insertedProjects[0].id,
          title: 'Introdução',
          status: 'CONCLUIDO',
          wordCount: 420,
          position: 1,
          content: 'Contexto inicial e objetivos do capítulo.',
        },
        {
          projectId: insertedProjects[0].id,
          title: 'Metodologia',
          status: 'EM_PROGRESSO',
          wordCount: 240,
          position: 2,
          content: 'Descrever abordagem e instrumentos.',
        },
      ]);
    }
  }

  const hasPlans = await db.select().from(saasPlans).limit(1);
  let basePlans = hasPlans;
  const createdPlans = !hasPlans[0];

  if (createdPlans) {
    basePlans = await db
      .insert(saasPlans)
      .values([
        {
          name: 'Essencial',
          description: 'Tempo, tarefas e reuniões para times pequenos.',
          priceCents: 1490,
          billingInterval: 'MONTHLY',
          maxUsers: 5,
          maxStorageGb: 50,
          aiEnabled: true,
          maxTeamAdminSlots: 1,
        },
        {
          name: 'Profissional',
          description: 'Projetos, recursos e finanças integradas.',
          priceCents: 4990,
          billingInterval: 'MONTHLY',
          maxUsers: 25,
          maxStorageGb: 200,
          aiEnabled: true,
          maxTeamAdminSlots: 1,
        },
        {
          name: 'Enterprise',
          description: 'Customização total, auditoria e integrações.',
          priceCents: 14990,
          billingInterval: 'MONTHLY',
          maxUsers: 200,
          maxStorageGb: 1024,
          aiEnabled: true,
          maxTeamAdminSlots: 2,
        },
      ])
      .returning();
  }

  const planMap = new Map(basePlans.map((plan) => [plan.name, plan.id]));

  const hasPlanModules = await db.select().from(saasPlanModules).limit(1);
  const createdModules = !hasPlanModules[0];
  if (createdModules) {
    const allModules = [
      'chronos',
      'reunify',
      'taskflow',
      'projectus',
      'resourcehub',
      'billtrak',
      'bibliotheca',
      'notepad',
      'scriptum',
    ];

    const essentialModules = ['chronos', 'reunify', 'taskflow', 'notepad'];
    const professionalModules = [
      'chronos',
      'reunify',
      'taskflow',
      'projectus',
      'resourcehub',
      'billtrak',
      'bibliotheca',
      'notepad',
      'scriptum',
    ];

    const entries: { planId: number; moduleKey: string; enabled: boolean }[] = [];

    allModules.forEach((moduleKey) => {
      const essentialId = planMap.get('Essencial');
      if (essentialId) {
        entries.push({
          planId: essentialId,
          moduleKey,
          enabled: essentialModules.includes(moduleKey),
        });
      }

      const professionalId = planMap.get('Profissional');
      if (professionalId) {
        entries.push({
          planId: professionalId,
          moduleKey,
          enabled: professionalModules.includes(moduleKey),
        });
      }

      const enterpriseId = planMap.get('Enterprise');
      if (enterpriseId) {
        entries.push({ planId: enterpriseId, moduleKey, enabled: true });
      }
    });

    if (entries.length) {
      await db.insert(saasPlanModules).values(entries);
    }
  }

  const hasTeamPlan = await db
    .select()
    .from(teamPlans)
    .where(eq(teamPlans.teamId, team.id))
    .limit(1);

  const [enterprisePlanRow] = await db
    .select({ id: saasPlans.id })
    .from(saasPlans)
    .where(eq(saasPlans.name, 'Enterprise'))
    .limit(1);

  const createdTeamPlan = !hasTeamPlan[0];
  if (createdTeamPlan && enterprisePlanRow) {
    await db.insert(teamPlans).values({
      teamId: team.id,
      planId: enterprisePlanRow.id,
      status: 'ATIVO',
      negotiatedPriceCents: null,
      billingCycleDay: 5,
      nextInvoiceDate: toDateString(addDays(15)),
    });
  }

  /** Módulos cobertos por `teamHasModuleEnabled` — o time seed fica sempre no plano Enterprise com todos ativos. */
  const seedDemoModuleKeys = [
    'chronos',
    'reunify',
    'taskflow',
    'projectus',
    'resourcehub',
    'billtrak',
    'bibliotheca',
    'notepad',
    'scriptum',
  ] as const;

  if (enterprisePlanRow) {
    const existingEntMods = await db
      .select({ moduleKey: saasPlanModules.moduleKey })
      .from(saasPlanModules)
      .where(eq(saasPlanModules.planId, enterprisePlanRow.id));
    const entHave = new Set(existingEntMods.map((r) => r.moduleKey));

    for (const moduleKey of seedDemoModuleKeys) {
      if (!entHave.has(moduleKey)) {
        await db.insert(saasPlanModules).values({
          planId: enterprisePlanRow.id,
          moduleKey,
          enabled: true,
        });
      } else {
        await db
          .update(saasPlanModules)
          .set({ enabled: true })
          .where(
            and(eq(saasPlanModules.planId, enterprisePlanRow.id), eq(saasPlanModules.moduleKey, moduleKey)),
          );
      }
    }

    const [seedTeamPlan] = await db.select().from(teamPlans).where(eq(teamPlans.teamId, team.id)).limit(1);
    if (seedTeamPlan) {
      await db
        .update(teamPlans)
        .set({ planId: enterprisePlanRow.id, status: 'ATIVO', updatedAt: new Date() })
        .where(eq(teamPlans.teamId, team.id));
    } else {
      await db.insert(teamPlans).values({
        teamId: team.id,
        planId: enterprisePlanRow.id,
        status: 'ATIVO',
        negotiatedPriceCents: null,
        billingCycleDay: 5,
        nextInvoiceDate: toDateString(addDays(15)),
      });
    }
  }

  if (createdPlans || createdModules || createdTeamPlan) {
    await db.insert(auditEvents).values({
      teamId: team.id,
      actorUserId: user.id,
      module: 'control-center',
      action: 'Seed inicial de planos e módulos',
      detail: 'Planos e módulos padrão criados.',
    });
  }

  const hasHealth = await db
    .select()
    .from(saasCustomerHealth)
    .where(eq(saasCustomerHealth.teamId, team.id))
    .limit(1);

  if (!hasHealth[0]) {
    await db.insert(saasCustomerHealth).values({
      teamId: team.id,
      healthScore: 78,
      churnRisk: 'BAIXO',
      lastActivityAt: new Date(),
      usageScore: 72,
      planFitScore: 80,
      supportScore: 65,
      recommendation: 'Manter acompanhamento mensal e sugerir upgrade do plano Profissional.',
    });
  }

  const hasAiModels = await db.select().from(aiModels).limit(1);
  if (!hasAiModels[0]) {
    await db.insert(aiModels).values([
      {
        name: 'Llama 3.1 8B',
        provider: 'Meta',
        type: 'LLM',
        status: 'PAUSADO',
        modelId: 'llama3.1-8b',
        isDefault: true,
        isOpenSource: true,
        notes: 'Modelo principal para geração e resumo.',
      },
      {
        name: 'Mistral 7B Instruct',
        provider: 'Mistral',
        type: 'LLM',
        status: 'PAUSADO',
        modelId: 'mistral-7b-instruct',
        isDefault: false,
        isOpenSource: true,
        notes: 'Alternativa leve para respostas rápidas.',
      },
      {
        name: 'Whisper Large v3',
        provider: 'OpenAI',
        type: 'ASR',
        status: 'PAUSADO',
        modelId: 'whisper-large-v3',
        isDefault: true,
        isOpenSource: true,
        notes: 'Transcrição de áudio para reuniões e notas.',
      },
      {
        name: 'BGE M3',
        provider: 'BAAI',
        type: 'EMBEDDING',
        status: 'PAUSADO',
        modelId: 'bge-m3',
        isDefault: true,
        isOpenSource: true,
        notes: 'Embeddings para busca semântica.',
      },
    ]);
  }

  const hasProjects = await db
    .select()
    .from(projectusProjects)
    .where(eq(projectusProjects.teamId, team.id))
    .limit(1);

  if (!hasProjects[0]) {
    const insertedProjects = await db.insert(projectusProjects).values([
      {
        teamId: team.id,
        name: 'Implantacao de laboratorio',
        status: 'EM_ANDAMENTO',
        dueDate: addDays(15),
        budgetCents: 250000,
      },
      {
        teamId: team.id,
        name: 'Sprint de aplicativo academico',
        status: 'EM_RISCO',
        dueDate: addDays(22),
        budgetCents: 180000,
      },
      {
        teamId: team.id,
        name: 'Documentacao e handoff',
        status: 'CONCLUIDO',
        dueDate: addDays(-5),
        budgetCents: 60000,
      },
    ]).returning();

    console.log(`Projetos inseridos: ${insertedProjects.length}`);
  }

  const projects = await db
    .select()
    .from(projectusProjects)
    .where(eq(projectusProjects.teamId, team.id))
    .limit(1);

  const baseProject = projects[0];
  if (baseProject) {
    const existingPhase = await db
      .select()
      .from(projectusPhases)
      .where(eq(projectusPhases.projectId, baseProject.id))
      .limit(1);

    if (!existingPhase[0]) {
      const phases = await db
        .insert(projectusPhases)
        .values([
          {
            projectId: baseProject.id,
            name: 'Planejamento',
            description: 'Definir escopo e metas.',
            startDate: toDateString(new Date()),
            endDate: toDateString(addDays(5)),
            status: 'PLANEJADA',
            position: 1,
          },
          {
            projectId: baseProject.id,
            name: 'Execucao',
            description: 'Implementacao do cronograma.',
            startDate: toDateString(addDays(6)),
            endDate: toDateString(addDays(14)),
            status: 'EM_ANDAMENTO',
            position: 2,
          },
        ])
        .returning();

      const tasks = await db.insert(projectusTasks).values([
        {
          projectId: baseProject.id,
          phaseId: phases[0]?.id,
          title: 'Mapear entregas principais',
          description: 'Lista de milestones iniciais.',
          status: 'ABERTA',
          priority: 'ALTA',
          startDate: toDateString(new Date()),
          dueDate: toDateString(addDays(3)),
          effortHours: 6,
          progress: 20,
        },
        {
          projectId: baseProject.id,
          phaseId: phases[1]?.id,
          title: 'Alinhar stakeholders',
          description: 'Reuniao de kickoff e ajustes.',
          status: 'EM_ANDAMENTO',
          priority: 'MEDIA',
          startDate: toDateString(addDays(6)),
          dueDate: toDateString(addDays(8)),
          effortHours: 4,
          progress: 40,
        },
      ]).returning();

      await db.insert(projectusMilestones).values([
        {
          projectId: baseProject.id,
          name: 'Kickoff aprovado',
          dueDate: toDateString(addDays(4)),
          status: 'ABERTO',
        },
        {
          projectId: baseProject.id,
          name: 'Primeira entrega',
          dueDate: toDateString(addDays(12)),
          status: 'ABERTO',
        },
      ]);

      await db.insert(projectusRisks).values([
        {
          projectId: baseProject.id,
          title: 'Dependencia de fornecedor',
          description: 'Atraso potencial no envio de materiais.',
          probability: 4,
          impact: 4,
          status: 'ABERTO',
          mitigation: 'Plano B com fornecedor local.',
        },
      ]);

      if (tasks.length >= 2) {
        await db.insert(projectusTaskDependencies).values({
          taskId: tasks[1].id,
          dependsOnTaskId: tasks[0].id,
        });
      }

      await ensureProjectusCostCategories(team.id);

      const catPlanning = await db
        .select()
        .from(projectusCostCategories)
        .where(and(eq(projectusCostCategories.teamId, team.id), eq(projectusCostCategories.code, 'PLANEJAMENTO')))
        .limit(1);
      const catOperational = await db
        .select()
        .from(projectusCostCategories)
        .where(and(eq(projectusCostCategories.teamId, team.id), eq(projectusCostCategories.code, 'OPERACIONAL')))
        .limit(1);

      const planCat = catPlanning[0];
      const opCat = catOperational[0];
      if (planCat && opCat) {
        await db.insert(projectusCostItems).values([
          {
            projectId: baseProject.id,
            phaseId: phases[0]?.id,
            taskId: tasks[0]?.id,
            type: 'PLANEJADO',
            categoryId: planCat.id,
            categoryDetail: null,
            category: planCat.label,
            amountCents: 12000,
            incurredAt: toDateString(new Date()),
            notes: 'Workshops e levantamento inicial',
          },
          {
            projectId: baseProject.id,
            phaseId: phases[1]?.id,
            taskId: tasks[1]?.id,
            type: 'REAL',
            categoryId: opCat.id,
            categoryDetail: null,
            category: opCat.label,
            amountCents: 8000,
            incurredAt: toDateString(new Date()),
            notes: 'Custos de kickoff',
          },
        ]);
      } else {
        console.warn('Seed Projectus: categorias de custo em falta; ignorando custos de exemplo.');
      }
    }
  }

  const hasResources = await db
    .select()
    .from(resourcehubResources)
    .where(eq(resourcehubResources.teamId, team.id))
    .limit(1);

  if (!hasResources[0]) {
    const skills = await db
      .insert(resourcehubSkills)
      .values([{ name: 'React' }, { name: 'UX' }, { name: 'Infraestrutura' }])
      .returning();

    const resources = await db
      .insert(resourcehubResources)
      .values([
        {
          teamId: team.id,
          name: 'Equipe Frontend',
          type: 'PESSOA',
          status: 'DISPONIVEL',
          capacityHoursPerWeek: 120,
          costRateCents: 15000,
          notes: 'Squad principal',
        },
        {
          teamId: team.id,
          name: 'Laboratório IoT',
          type: 'EQUIPAMENTO',
          status: 'RESERVADO',
          capacityHoursPerWeek: 40,
          costRateCents: 8000,
          notes: 'Uso compartilhado',
        },
        {
          teamId: team.id,
          name: 'Analista UX',
          type: 'PESSOA',
          status: 'DISPONIVEL',
          capacityHoursPerWeek: 30,
          costRateCents: 9000,
          notes: 'Disponível para pesquisas',
        },
      ])
      .returning();

    if (resources.length > 0 && skills.length > 0) {
      await db.insert(resourcehubResourceSkills).values([
        {
          resourceId: resources[0].id,
          skillId: skills[0].id,
          level: 4,
        },
        {
          resourceId: resources[2].id,
          skillId: skills[1].id,
          level: 5,
        },
      ]);
    }

    const firstProject = await db
      .select()
      .from(projectusProjects)
      .where(eq(projectusProjects.teamId, team.id))
      .limit(1);

    if (firstProject[0] && resources[0]) {
      await db.insert(resourcehubAllocations).values([
        {
          resourceId: resources[0].id,
          projectId: firstProject[0].id,
          startDate: toDateString(new Date()),
          endDate: toDateString(addDays(14)),
          hoursPerWeek: 24,
          status: 'ATIVO',
        },
        {
          resourceId: resources[2].id,
          projectId: firstProject[0].id,
          startDate: toDateString(addDays(3)),
          endDate: toDateString(addDays(10)),
          hoursPerWeek: 12,
          status: 'ATIVO',
        },
      ]);
    }
  }

  const hasBilltrak = await db
    .select()
    .from(billtrakAccounts)
    .where(eq(billtrakAccounts.teamId, team.id))
    .limit(1);

  if (!hasBilltrak[0]) {
    const categories = await db
      .insert(billtrakCategories)
      .values([
        { name: 'Assinaturas', type: 'DESPESA' },
        { name: 'Operacional', type: 'DESPESA' },
        { name: 'Receita', type: 'RECEITA' },
      ])
      .returning();

    const accounts = await db
      .insert(billtrakAccounts)
      .values([
        {
          teamId: team.id,
          name: 'Conta principal',
          type: 'CORRENTE',
          balanceCents: 125000,
        },
      ])
      .returning();

    const bills = await db
      .insert(billtrakBills)
      .values([
        {
          teamId: team.id,
          title: 'Mensalidade plataforma',
          categoryId: categories[0]?.id,
          projectId: null,
          status: 'PENDENTE',
          amountCents: 4990,
          dueDate: toDateString(addDays(5)),
          recurring: true,
          recurrenceRule: 'MONTHLY',
          notes: 'Assinatura institucional',
        },
        {
          teamId: team.id,
          title: 'Despesa com materiais',
          categoryId: categories[1]?.id,
          projectId: null,
          status: 'PAGO',
          amountCents: 32000,
          dueDate: toDateString(addDays(-2)),
          paidAt: toDateString(addDays(-1)),
          recurring: false,
          notes: 'Compras do laboratório',
        },
        {
          teamId: team.id,
          title: 'Faturamento projeto',
          categoryId: categories[2]?.id,
          projectId: null,
          status: 'RECEBIDO',
          amountCents: 280000,
          dueDate: toDateString(addDays(-3)),
          paidAt: toDateString(addDays(-2)),
          recurring: false,
          notes: 'Entrega parcial',
        },
      ])
      .returning();

    if (accounts[0]) {
      await db.insert(billtrakTransactions).values([
        {
          teamId: team.id,
          accountId: accounts[0].id,
          billId: bills[1]?.id,
          type: 'DEBITO',
          description: 'Pagamento de materiais',
          amountCents: 32000,
          occurredAt: toDateString(addDays(-1)),
        },
        {
          teamId: team.id,
          accountId: accounts[0].id,
          billId: bills[2]?.id,
          type: 'CREDITO',
          description: 'Recebimento projeto',
          amountCents: 280000,
          occurredAt: toDateString(addDays(-2)),
        },
      ]);
    }
  }

  try {
    await createStripeProducts();
  } catch (error) {
    console.warn('Stripe falhou. Seed finalizado sem Stripe.', error);
  }
}

seed()
  .catch((error) => {
    console.error('Falha no seed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed finalizado. Encerrando...');
    process.exit(0);
  });
