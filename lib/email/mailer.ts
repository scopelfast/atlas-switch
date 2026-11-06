import nodemailer from 'nodemailer';

type InviteEmailPayload = {
  to: string;
  teamName: string;
  role: string;
  inviteUrl: string;
  /** Nome indicado no convite (ex.: operador a registar). */
  invitedDisplayName?: string;
};

type PasswordResetEmailPayload = {
  to: string;
  resetUrl: string;
};

type TaskflowNotificationPayload = {
  to: string;
  taskTitle: string;
  taskId: number;
  type: 'assigned' | 'due_soon' | 'daily_digest' | 'intervention_idle';
  dueDate?: string | null;
  creatorName?: string | null;
  taskCount?: number;
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 0;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

/**
 * Envia e-mail de convite. Retorna false se SMTP não estiver configurado ou se o envio falhar.
 */
export async function sendInvitationEmail(
  payload: InviteEmailPayload,
): Promise<boolean> {
  const config = getSmtpConfig();
  if (!config) {
    console.warn('[mailer] SMTP não configurado. Convite não será enviado por e-mail.');
    return false;
  }

  const { host, port, user, pass, from } = config;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const rawName = payload.invitedDisplayName?.trim();
    const safeName = rawName ? escapeHtml(rawName) : '';
    const whoPlain = rawName ? `${rawName} — ` : '';
    const subject = `Convite para o time ${payload.teamName}`;
    const text = `${whoPlain}Você foi convidado para o time ${payload.teamName} como ${payload.role}.
Passo 1: abra o link para confirmar o e-mail. Passo 2: defina a sua senha no ecrã seguinte.
Link: ${payload.inviteUrl}`;
    const html = `
    ${safeName ? `<p>Olá, <strong>${safeName}</strong>.</p>` : ''}
    <p>Você foi convidado para o time <strong>${payload.teamName}</strong> como <strong>${payload.role}</strong>.</p>
    <p><strong>Passo 1:</strong> abra o link para confirmar o e-mail.</p>
    <p><strong>Passo 2:</strong> defina a sua senha no ecrã seguinte.</p>
    <p><a href="${payload.inviteUrl}">Abrir convite seguro</a></p>
    <p>Se não reconhecer este convite, ignore este e-mail.</p>
  `;

    await transporter.sendMail({
      from,
      to: payload.to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('[mailer] Falha ao enviar convite por e-mail.', error);
    return false;
  }
}

/**
 * M2.5 — e-mail de redefinição de senha (distinto do convite). Retorna false sem SMTP ou se falhar o envio.
 */
export async function sendPasswordResetEmail(
  payload: PasswordResetEmailPayload,
): Promise<boolean> {
  const config = getSmtpConfig();
  if (!config) {
    console.warn('[mailer] SMTP não configurado. Redefinição de senha não será enviada por e-mail.');
    return false;
  }

  const { host, port, user, pass, from } = config;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const subject = 'AtlasSwitch — redefinir a sua senha';
    const text = `Recebemos um pedido para redefinir a senha da sua conta AtlasSwitch.
Se foi você, abra o link (válido por tempo limitado): ${payload.resetUrl}
Se não reconhece este pedido, ignore este e-mail.`;
    const html = `
    <p>Recebemos um pedido para redefinir a senha da sua conta <strong>AtlasSwitch</strong>.</p>
    <p>Se foi você, clique no link abaixo (válido por tempo limitado):</p>
    <p><a href="${payload.resetUrl}">Redefinir senha</a></p>
    <p>Se não reconhece este pedido, ignore este e-mail.</p>
  `;

    await transporter.sendMail({
      from,
      to: payload.to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('[mailer] Falha ao enviar e-mail de redefinição de senha.', error);
    return false;
  }
}

/**
 * Envia notificação por e-mail do Taskflow (tarefa atribuída, vencimento próximo ou digest diário).
 */
export async function sendTaskflowNotification(payload: TaskflowNotificationPayload) {
  try {
    const config = getSmtpConfig();
    if (!config) {
      console.warn('[mailer] SMTP não configurado. Notificação Taskflow ignorada.', payload.type);
      return;
    }

    const { host, port, user, pass, from } = config;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:3003';
    const taskUrl = `${baseUrl}/dashboard/taskflow`;

    let subject = '';
    let text = '';
    let html = '';

    if (payload.type === 'assigned') {
      subject = `[AtlasSwitch] Nova tarefa atribuída: ${payload.taskTitle}`;
      text = `Você foi atribuído à tarefa "${payload.taskTitle}". ${payload.dueDate ? `Prazo: ${payload.dueDate}` : ''} ${payload.creatorName ? `Criada por ${payload.creatorName}.` : ''} Acesse: ${taskUrl}`;
      html = `
        <p>Você foi atribuído à tarefa <strong>${payload.taskTitle}</strong>.</p>
        ${payload.dueDate ? `<p>Prazo: ${payload.dueDate}</p>` : ''}
        ${payload.creatorName ? `<p>Criada por ${payload.creatorName}.</p>` : ''}
        <p><a href="${taskUrl}">Abrir Taskflow</a></p>
      `;
    } else if (payload.type === 'due_soon') {
      subject = `[AtlasSwitch] Tarefa próxima do vencimento: ${payload.taskTitle}`;
      text = `A tarefa "${payload.taskTitle}" vence em breve. ${payload.dueDate ? `Prazo: ${payload.dueDate}` : ''} Acesse: ${taskUrl}`;
      html = `
        <p>A tarefa <strong>${payload.taskTitle}</strong> está próxima do vencimento.</p>
        ${payload.dueDate ? `<p>Prazo: ${payload.dueDate}</p>` : ''}
        <p><a href="${taskUrl}">Abrir Taskflow</a></p>
      `;
    } else if (payload.type === 'daily_digest') {
      subject = `[AtlasSwitch] Suas ${payload.taskCount ?? 0} tarefas para hoje`;
      text = `Você tem ${payload.taskCount ?? 0} tarefa(s) para hoje. Acesse: ${taskUrl}`;
      html = `
        <p>Resumo do dia: você tem <strong>${payload.taskCount ?? 0}</strong> tarefa(s) para hoje.</p>
        <p><a href="${taskUrl}">Abrir Taskflow</a></p>
      `;
    } else if (payload.type === 'intervention_idle') {
      const op = payload.creatorName?.trim() || 'Um operador';
      subject = `[AtlasSwitch] Timer pausado por inatividade — ${payload.taskTitle}`;
      text = `${op} deixou de responder ao ping de presença no timer da tarefa «${payload.taskTitle}». A intervenção foi encerrada automaticamente. Abra o Taskflow: ${taskUrl}`;
      html = `
        <p><strong>${escapeHtml(op)}</strong> não respondeu ao ping de inatividade no timer.</p>
        <p>Tarefa: <strong>${escapeHtml(payload.taskTitle)}</strong>. A intervenção foi encerrada automaticamente por inatividade no timer.</p>
        <p><a href="${taskUrl}">Abrir Taskflow</a></p>
      `;
    }

    if (subject && text && html) {
      await transporter.sendMail({
        from,
        to: payload.to,
        subject,
        text,
        html,
      });
    }
  } catch {
    // SMTP não configurado ou erro no envio - não quebra o fluxo
    console.warn('[mailer] Falha ao enviar e-mail. Execução continuou.');
  }
}
