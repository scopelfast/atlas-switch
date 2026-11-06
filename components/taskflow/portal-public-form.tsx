'use client';

import { useState } from 'react';

type Props = {
  slug: string;
  teamName: string;
};

export function PortalPublicForm({ slug, teamName }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/taskflow/public-portal/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          submitterName,
          submitterEmail,
          companyWebsite,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFeedback({ kind: 'err', text: j.error || 'Não foi possível enviar.' });
        return;
      }
      setFeedback({
        kind: 'ok',
        text: 'O seu pedido foi recebido. A equipe irá analisá-lo antes de criar a tarefa no quadro.',
      });
      setTitle('');
      setDescription('');
      setSubmitterName('');
      setSubmitterEmail('');
      setCompanyWebsite('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-lg flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Pedido para <span className="font-semibold text-slate-800 dark:text-slate-100">{teamName}</span>. Os
        campos de contacto são opcionais; se os preencher, serão tratados conforme a política de privacidade do
        responsável pelo time (LGPD).
      </p>
      {feedback ? (
        <p
          className={
            feedback.kind === 'ok'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100'
              : 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100'
          }
        >
          {feedback.text}
        </p>
      ) : null}
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Título *</label>
        <input
          required
          maxLength={500}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resumo do pedido"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Descrição</label>
        <textarea
          maxLength={8000}
          rows={5}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">O seu nome (opcional)</label>
        <input
          maxLength={120}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
          value={submitterName}
          onChange={(e) => setSubmitterName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">E-mail (opcional)</label>
        <input
          type="email"
          maxLength={255}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
          value={submitterEmail}
          onChange={(e) => setSubmitterEmail(e.target.value)}
        />
      </div>
      <div className="sr-only" aria-hidden>
        <label htmlFor="portal-company-website">Website da empresa</label>
        <input
          id="portal-company-website"
          tabIndex={-1}
          autoComplete="off"
          value={companyWebsite}
          onChange={(e) => setCompanyWebsite(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? 'A enviar…' : 'Enviar pedido'}
      </button>
    </form>
  );
}
