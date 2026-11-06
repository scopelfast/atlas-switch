'use server';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  teams,
  teamMembers,
  activityLogs,
  type NewTeam,
  type NewTeamMember,
  type NewActivityLog,
  ActivityType,
  invitations,
  passwordResetTokens,
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  canInviteToTeam,
  canInviterAssignTeamRole,
  canRemoveTeamMemberAsAdmin,
  canResendTeamInvite,
  normalizeRole,
  reportsToRequiredForInviteRole,
  superiorRolesForInvitee,
  userRoleFromAcceptedTeamRole,
} from '@/lib/auth/permissions';
import { sendInvitationEmail, sendPasswordResetEmail } from '@/lib/email/mailer';
import { assertTeamAdminSlotsAvailable } from '@/lib/team/admin-slots';
import { assertSeatsAvailableForNewInvite } from '@/lib/team/seat-limits';
import {
  generateInviteOpaqueToken,
  hashInviteOpaqueToken,
  inviteTokenExpiresAt,
} from '@/lib/invites/invite-token';
import { syncInvitationExpiryOnAccess } from '@/lib/invites/sync-invitation-expiry';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';

/** URL pública da app (convites, links em e-mail). Sem barra final. */
function appPublicBaseUrl() {
  const raw = process.env.BASE_URL || 'http://localhost:3003';
  return raw.replace(/\/+$/, '');
}

/**
 * Registra um evento de atividade para auditoria.
 */
async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || ''
  };
  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

/**
 * Autentica o usuário e inicia a sessão.
 */
export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const userWithTeam = await db
    .select({
      user: users,
      team: teams
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.email, email))
    .limit(1);

  if (userWithTeam.length === 0) {
    return {
      error: 'E-mail ou senha inválidos. Tente novamente.',
      email,
      password
    };
  }

  const { user: foundUser, team: foundTeam } = userWithTeam[0];

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.passwordHash
  );

  if (!isPasswordValid) {
    return {
      error: 'E-mail ou senha inválidos. Tente novamente.',
      email,
      password
    };
  }

  await Promise.all([
    setSession(foundUser),
    logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN)
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: foundTeam, priceId });
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1, 'Informe o seu nome.').max(100),
  inviteId: z.string().optional(),
});

/**
 * Cria um novo usuário e time (ou aceita convite).
 * Com convite, valida o convite antes de inserir o utilizador (evita registos órfãos).
 */
export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, name } = data;
  const inviteParam =
    data.inviteId && String(data.inviteId).trim() !== ''
      ? String(data.inviteId).trim()
      : undefined;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'Este e-mail já está cadastrado. Faça login ou utilize outro endereço.',
      email,
      password,
      name,
    };
  }

  const passwordHash = await hashPassword(password);
  let createdTeam: typeof teams.$inferSelect | null = null;
  let teamId: number;
  let teamMemberRole: string;
  let createdUser: User;
  let reportsToForNewMember: number | null = null;

  if (inviteParam) {
    const inviteNumericId = parseInt(inviteParam, 10);
    if (Number.isNaN(inviteNumericId)) {
      return {
        error:
          'Link de convite inválido. Peça a quem o convidou um novo link (o identificador na URL está incorreto ou o convite não existe).',
        email,
        password,
        name,
      };
    }

    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, inviteNumericId),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (!invitation) {
      const [legacyCheck] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, inviteNumericId))
        .limit(1);
      if (legacyCheck?.tokenHash && legacyCheck.status === 'activated') {
        return {
          error:
            'Este convite usa o fluxo em dois passos: volte ao link do e-mail e conclua a definição da senha na página indicada (não utilize o registo com ID).',
          email,
          password,
          name,
        };
      }
      return {
        error:
          'Convite inválido ou já utilizado. Solicite um novo convite a quem gere membros no seu time.',
        email,
        password,
        name,
      };
    }

    if (invitation.tokenHash) {
      return {
        error:
          'Este convite deve ser aceite pelo link seguro enviado por e-mail (confirmação de e-mail e depois senha). Não utilize o registo com ID.',
        email,
        password,
        name,
      };
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return {
        error:
          'O e-mail deve ser exatamente o do convite. Utilize o mesmo endereço para o qual o convite foi enviado.',
        email,
        password,
        name,
      };
    }

    teamId = invitation.teamId;
    teamMemberRole = invitation.role;
    const globalUserRole = userRoleFromAcceptedTeamRole(invitation.role);
    reportsToForNewMember = invitation.reportsToUserId ?? null;
    const displayName = (
      invitation.invitedName?.trim() ||
      name.trim() ||
      email.split('@')[0] ||
      'Utilizador'
    ).slice(0, 100);

    if (teamMemberRole === 'admin') {
      const adminGate = await assertTeamAdminSlotsAvailable(teamId, 'complete_membership');
      if (!adminGate.ok) {
        return {
          error: adminGate.message,
          email,
          password,
          name,
        };
      }
    }

    const [insertedUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: displayName,
        role: globalUserRole,
      })
      .returning();

    if (!insertedUser) {
      return {
        error: 'Não foi possível criar o usuário. Tente novamente.',
        email,
        password,
        name,
      };
    }
    createdUser = insertedUser;

    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id));

    await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION);

    [createdTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
  } else {
    const [insertedUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: name.trim().slice(0, 100),
        role: 'owner',
      })
      .returning();

    if (!insertedUser) {
      return {
        error: 'Não foi possível criar o usuário. Tente novamente.',
        email,
        password,
        name,
      };
    }
    createdUser = insertedUser;

    const newTeam: NewTeam = {
      name: `Time de ${email}`,
    };

    const [newTeamRow] = await db.insert(teams).values(newTeam).returning();

    if (!newTeamRow) {
      await db.delete(users).where(eq(users.id, createdUser.id));
      return {
        error: 'Não foi possível criar o time. Tente novamente.',
        email,
        password,
        name,
      };
    }

    createdTeam = newTeamRow;
    teamId = newTeamRow.id;
    teamMemberRole = 'owner';

    await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM);
  }

  const newTeamMember: NewTeamMember = {
    userId: createdUser.id,
    teamId,
    role: teamMemberRole,
    reportsToUserId: reportsToForNewMember,
  };

  await Promise.all([
    db.insert(teamMembers).values(newTeamMember),
    logActivity(teamId, createdUser.id, ActivityType.SIGN_UP),
    setSession(createdUser),
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: createdTeam, priceId });
  }

  redirect('/dashboard');
});

const completeInvitedSignUpSchema = z.object({
  token: z.string().min(20, 'Link inválido.'),
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
});

/**
 * M2.3 — segundo passo do convite: definir senha após confirmação de e-mail (M2.2).
 */
export const completeInvitedSignUp = validatedAction(
  completeInvitedSignUpSchema,
  async (data) => {
    const { token, password, confirmPassword } = data;
    if (password !== confirmPassword) {
      return { error: 'A confirmação não confere com a nova senha.', token };
    }

    const th = hashInviteOpaqueToken(token);
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, th))
      .limit(1);

    if (!invitation) {
      return { error: 'Link inválido. Solicite um novo convite.', token: '' };
    }

    const gate = await syncInvitationExpiryOnAccess(invitation);
    if (gate === 'expired') {
      return {
        error:
          'Este convite expirou (prazo do link ou tempo para definir a senha após confirmar o e-mail). Peça um novo convite.',
        token: '',
      };
    }
    if (gate === 'used') {
      return { error: 'Este convite já foi utilizado.', token: '' };
    }

    if (invitation.status === 'pending') {
      return {
        error: 'Confirme primeiro o e-mail: abra o primeiro link do convite antes de definir a senha.',
        token,
      };
    }
    if (invitation.status !== 'activated') {
      return { error: 'Este convite já foi utilizado ou não está disponível.', token: '' };
    }

    const email = invitation.email;
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return {
        error: 'Este e-mail já está cadastrado. Faça login.',
        token: '',
      };
    }

    const passwordHash = await hashPassword(password);
    const displayName = (
      invitation.invitedName?.trim() ||
      email.split('@')[0] ||
      'Utilizador'
    ).slice(0, 100);
    const globalUserRole = userRoleFromAcceptedTeamRole(invitation.role);
    const teamId = invitation.teamId;
    const teamMemberRole = invitation.role;
    const reportsToForNewMember = invitation.reportsToUserId ?? null;

    if (teamMemberRole === 'admin') {
      const adminGate = await assertTeamAdminSlotsAvailable(teamId, 'complete_membership');
      if (!adminGate.ok) {
        return { error: adminGate.message, token };
      }
    }

    const [insertedUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: displayName,
        role: globalUserRole,
      })
      .returning();

    if (!insertedUser) {
      return { error: 'Não foi possível criar o usuário. Tente novamente.', token };
    }

    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id));

    await logActivity(teamId, insertedUser.id, ActivityType.ACCEPT_INVITATION);

    const newTeamMember: NewTeamMember = {
      userId: insertedUser.id,
      teamId,
      role: teamMemberRole,
      reportsToUserId: reportsToForNewMember,
    };

    await Promise.all([
      db.insert(teamMembers).values(newTeamMember),
      logActivity(teamId, insertedUser.id, ActivityType.SIGN_UP),
      setSession(insertedUser),
    ]);

    redirect('/dashboard');
  },
);

/**
 * Encerra a sessão do usuário.
 */
export async function signOut() {
  const user = (await getUser()) as User;
  const userWithTeam = await getUserWithTeam(user.id);
  await logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT);
  (await cookies()).delete('session');
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

/**
 * Atualiza a senha do usuário autenticado.
 */
export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'A senha atual está incorreta.'
      };
    }

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'A nova senha precisa ser diferente da atual.'
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'A confirmação não confere com a nova senha.'
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD)
    ]);

    return {
      success: 'Senha atualizada com sucesso.'
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100)
});

/**
 * Exclui a conta do usuário autenticado.
 */
export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        password,
        error: 'Senha incorreta. A conta não foi excluída.'
      };
    }

    const userWithTeam = await getUserWithTeam(user.id);

    await logActivity(
      userWithTeam?.teamId,
      user.id,
      ActivityType.DELETE_ACCOUNT
    );

    // Soft delete
    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: sql`CONCAT(email, '-', id, '-deleted')` // Garante unicidade do e-mail
      })
      .where(eq(users.id, user.id));

    if (userWithTeam?.teamId) {
      await db
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, user.id),
            eq(teamMembers.teamId, userWithTeam.teamId)
          )
        );
    }

    (await cookies()).delete('session');
    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  email: z.string().email('E-mail inválido')
});

/**
 * Atualiza dados básicos da conta.
 */
export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT)
    ]);

    return { name, success: 'Conta atualizada com sucesso.' };
  }
);

const removeTeamMemberSchema = z.object({
  memberId: z.coerce.number().int().positive(),
});

/**
 * Remove um membro do time (dono ou administrador do time — ver `canRemoveTeamMemberAsAdmin`).
 */
export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'Usuário não faz parte de um time.' };
    }
    if (!canRemoveTeamMemberAsAdmin(user.role)) {
      return { error: 'Apenas o proprietário ou o administrador do time pode remover membros.' };
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      );

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    return { success: 'Membro removido com sucesso.' };
  }
);

const teamInviteRoleSchema = z.enum(['member', 'supervisor', 'gestor', 'admin']);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('E-mail inválido'),
  name: z.string().trim().min(1, 'Nome do convidado é obrigatório.').max(100),
  role: teamInviteRoleSchema,
  reportsToUserId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
});

/**
 * Convida um novo membro para o time (perfis com `canInviteToTeam`).
 */
export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, name, role, reportsToUserId } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'Usuário não faz parte de um time.' };
    }
    if (!canInviteToTeam(user.role)) {
      return { error: 'O seu perfil não pode enviar convites para este time.' };
    }
    if (!canInviterAssignTeamRole(user.role, role)) {
      return {
        error:
          'Não pode atribuir esta função com o seu perfil. Supervisor convida apenas Membro; Gestor convida Supervisor e Membro; Administrador do time convida Gestor.',
      };
    }

    if (reportsToRequiredForInviteRole(role)) {
      if (!reportsToUserId) {
        return {
          error:
            'Para Membro ou Supervisor é obrigatório indicar a quem a pessoa reporta (superior no time).',
        };
      }
      const [superior] = await db
        .select({
          userId: teamMembers.userId,
          role: teamMembers.role,
        })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, userWithTeam.teamId),
            eq(teamMembers.userId, reportsToUserId),
          ),
        )
        .limit(1);
      if (!superior) {
        return { error: 'O superior indicado não pertence a este time.' };
      }
      const sup = normalizeRole(superior.role);
      const allowed = superiorRolesForInvitee(role);
      if (!allowed.includes(sup)) {
        return {
          error:
            'O superior indicado não tem a função adequada para este convite (Membro reporta a Supervisor ou acima; Supervisor reporta a Gestor ou acima).',
        };
      }
    }

    const existingMember = await db
      .select()
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .where(
        and(eq(users.email, email), eq(teamMembers.teamId, userWithTeam.teamId))
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'Este usuário já faz parte do time.' };
    }

    // Verifica se já existe convite pendente
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.teamId, userWithTeam.teamId),
          inArray(invitations.status, ['pending', 'activated']),
        ),
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      const row = existingInvitation[0];
      if (row.tokenHash) {
        return {
          error:
            'Já existe um convite em curso para este e-mail. Use «Reenviar convite» para gerar um novo link seguro, ou conclua o registo com o link já enviado.',
        };
      }
      const inviteUrl = `${appPublicBaseUrl()}/sign-up?inviteId=${row.id}`;
      return {
        error:
          'Já existe um convite pendente (legado) para este e-mail. Use o link abaixo ou peça um reenvio.',
        inviteUrl,
      };
    }

    const seats = await assertSeatsAvailableForNewInvite(userWithTeam.teamId);
    if (!seats.ok) {
      return { error: seats.message };
    }

    if (role === 'admin') {
      const adminGate = await assertTeamAdminSlotsAvailable(userWithTeam.teamId, 'new_invite');
      if (!adminGate.ok) {
        return { error: adminGate.message };
      }
    }

    // Cria um novo convite
    const rawInviteToken = generateInviteOpaqueToken();
    await db.insert(invitations).values({
      teamId: userWithTeam.teamId,
      email,
      invitedName: name.trim().slice(0, 100),
      role,
      reportsToUserId:
        reportsToRequiredForInviteRole(role) && reportsToUserId
          ? reportsToUserId
          : null,
      invitedBy: user.id,
      status: 'pending',
      tokenHash: hashInviteOpaqueToken(rawInviteToken),
      tokenExpiresAt: inviteTokenExpiresAt(),
    });

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    );

    const inviteUrl = `${appPublicBaseUrl()}/invite?token=${encodeURIComponent(rawInviteToken)}`;

    const [teamRow] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, userWithTeam.teamId!))
      .limit(1);
    const teamName = teamRow?.name ?? 'Time';

    const sent = await sendInvitationEmail({
      to: email,
      teamName,
      role,
      inviteUrl,
      invitedDisplayName: name.trim().slice(0, 100),
    });

    if (sent) {
      return { success: 'Convite enviado por e-mail com sucesso.', inviteUrl };
    }

    return {
      error:
        'Convite criado, mas o e-mail não foi enviado (verifique SMTP no .env). Partilhe o link abaixo manualmente.',
      inviteUrl,
    };
  }
);

const resendInviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

/**
 * Reenvia o e-mail de um convite pendente para o mesmo time (perfis com `canResendTeamInvite`).
 */
export const resendTeamInvitation = validatedActionWithUser(
  resendInviteSchema,
  async (data, _, user) => {
    const { email } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'Usuário não faz parte de um time.' };
    }
    if (!canResendTeamInvite(user.role)) {
      return { error: 'O seu perfil não pode reenviar convites.' };
    }

    const [pending] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.teamId, userWithTeam.teamId),
          or(
            eq(invitations.status, 'pending'),
            eq(invitations.status, 'activated'),
            eq(invitations.status, 'expired'),
          ),
        ),
      )
      .limit(1);

    if (!pending) {
      return {
        error: 'Não há convite pendente, em confirmação ou expirado para reenviar neste e-mail.',
      };
    }

    if (!canInviterAssignTeamRole(user.role, pending.role)) {
      return {
        error:
          'Não pode reenviar este convite: a função convidada está fora da matriz permitida para o seu perfil.',
      };
    }

    const rawInviteToken = generateInviteOpaqueToken();
    await db
      .update(invitations)
      .set({
        tokenHash: hashInviteOpaqueToken(rawInviteToken),
        tokenExpiresAt: inviteTokenExpiresAt(),
        status: 'pending',
        activatedAt: null,
      })
      .where(eq(invitations.id, pending.id));

    const inviteUrl = `${appPublicBaseUrl()}/invite?token=${encodeURIComponent(rawInviteToken)}`;

    const [teamRow] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, userWithTeam.teamId))
      .limit(1);
    const teamName = teamRow?.name ?? 'Time';

    const sent = await sendInvitationEmail({
      to: email,
      teamName,
      role: pending.role,
      inviteUrl,
      invitedDisplayName: pending.invitedName?.trim() || undefined,
    });

    if (sent) {
      return { success: 'Convite reenviado por e-mail.', inviteUrl };
    }

    return {
      error:
        'Não foi possível enviar o e-mail (SMTP). Copie o link abaixo e envie manualmente ao convidado.',
      inviteUrl,
    };
  },
);

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function hashPasswordResetToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

const requestPasswordResetSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

/**
 * M2.5 — pedido de redefinição de senha (token opaco; distinto do convite).
 * Resposta genérica se o e-mail não existir (evita enumeração de contas).
 */
export const requestPasswordReset = validatedAction(
  requestPasswordResetSchema,
  async (data) => {
    const email = data.email.trim().toLowerCase();
    const generic = {
      success:
        'Se existir uma conta com este e-mail, enviámos instruções para redefinir a senha. Verifique a caixa de entrada.',
    };

    const [userRow] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (!userRow) {
      return generic;
    }

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userRow.id));

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await db.insert(passwordResetTokens).values({
      userId: userRow.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${appPublicBaseUrl()}/reset-password?token=${rawToken}`;
    const sent = await sendPasswordResetEmail({
      to: userRow.email,
      resetUrl,
    });

    if (sent) {
      return generic;
    }

    return {
      error:
        'Não foi possível enviar o e-mail (SMTP). Copie o link abaixo apenas se confiar neste ambiente.',
      resetUrl,
    };
  },
);

const resetPasswordWithTokenSchema = z.object({
  token: z.string().min(20, 'Link inválido.'),
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
});

/**
 * M2.5 — define nova senha com token válido; invalida tokens desse utilizador.
 */
export const resetPasswordWithToken = validatedAction(
  resetPasswordWithTokenSchema,
  async (data) => {
    const { token, password, confirmPassword } = data;

    if (password !== confirmPassword) {
      return { error: 'A confirmação não confere com a nova senha.', token };
    }

    const tokenHash = hashPasswordResetToken(token);
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!row || row.usedAt) {
      return {
        error: 'Link inválido ou já utilizado. Solicite uma nova redefinição de senha.',
        token: '',
      };
    }

    if (new Date(row.expiresAt) < new Date()) {
      return {
        error: 'Este link expirou. Solicite uma nova redefinição de senha.',
        token: '',
      };
    }

    const newPasswordHash = await hashPassword(password);
    const userWithTeam = await getUserWithTeam(row.userId);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, row.userId));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, row.userId));
    });

    await logActivity(userWithTeam?.teamId, row.userId, ActivityType.UPDATE_PASSWORD);

    redirect('/sign-in?reset=ok');
  },
);
