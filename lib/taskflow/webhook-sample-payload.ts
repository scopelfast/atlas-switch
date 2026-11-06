/** Corpo de exemplo alinhado a `buildTaskWebhookPayload` (E8.5) — dados fictícios. */
export function buildWebhookSamplePayload(teamId: number, teamName: string) {
  return {
    event: 'task.created',
    teamId,
    teamName,
    task: {
      id: 0,
      title: 'Exemplo: rever proposta com cliente',
      columnId: 0,
      statusId: 0,
      priority: 'MEDIUM',
      dueDate: '2026-04-30T00:00:00.000Z',
      assigneeIds: [0],
    },
    sentAt: new Date().toISOString(),
    _atlasNote:
      'Payload de exemplo para Zapier/Make. Os webhooks reais usam ids numéricos reais e não incluem teamName nem _atlasNote.',
  };
}
