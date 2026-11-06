'use client';

import { useEffect, useState } from 'react';

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return 'agora mesmo';
  if (diffInSeconds < 60) return 'agora mesmo';
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} min atrás`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} h atrás`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)} dias atrás`;
  return date.toLocaleDateString('pt-BR');
}

type Props = {
  /** ISO 8601 string (UTC) para evitar problemas de fuso horário */
  dateIso: string;
};

/**
 * Exibe tempo relativo no fuso do usuário.
 * Calcula no cliente para evitar diferença entre servidor e navegador.
 */
export function RelativeTime({ dateIso }: Props) {
  const parsed = new Date(dateIso);
  const [label, setLabel] = useState(() => getRelativeTime(parsed));

  useEffect(() => {
    const p = new Date(dateIso);
    setLabel(getRelativeTime(p));
    const interval = setInterval(() => setLabel(getRelativeTime(p)), 60_000);
    return () => clearInterval(interval);
  }, [dateIso]);

  return <>{label}</>;
}
