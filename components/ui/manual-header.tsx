import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  CalendarClock,
  CheckSquare,
  Briefcase,
  Boxes,
  CreditCard,
  Library,
  NotebookPen,
  FilePenLine,
  Video,
  ShieldCheck,
  Brain,
  Settings,
  Shield,
  Activity,
  Users,
  FileText,
  Plug,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ManualHeaderProps = {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
};

function resolveVisual(backHref: string) {
  const key = backHref.toLowerCase();
  if (key.includes('control-integrations')) {
    return { icon: Plug, accent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' };
  }
  if (key.includes('taskflow')) {
    return { icon: CheckSquare, accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-300' };
  }
  if (key.includes('chronos')) {
    return { icon: CalendarClock, accent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' };
  }
  if (key.includes('reunify')) {
    return { icon: Video, accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' };
  }
  if (key.includes('projectus')) {
    return { icon: Briefcase, accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' };
  }
  if (key.includes('resourcehub')) {
    return { icon: Boxes, accent: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300' };
  }
  if (key.includes('billtrak')) {
    return { icon: CreditCard, accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' };
  }
  if (key.includes('bibliotheca')) {
    return { icon: Library, accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' };
  }
  if (key.includes('notepad')) {
    return { icon: NotebookPen, accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' };
  }
  if (key.includes('scriptum')) {
    return { icon: FilePenLine, accent: 'bg-orange-500/10 text-orange-600 dark:text-orange-300' };
  }
  if (key.includes('ai-center')) {
    return { icon: Brain, accent: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300' };
  }
  if (key.includes('control-center')) {
    return { icon: ShieldCheck, accent: 'bg-slate-500/10 text-slate-700 dark:text-slate-200' };
  }
  if (key.includes('/general')) {
    return { icon: Settings, accent: 'bg-slate-500/10 text-slate-700 dark:text-slate-200' };
  }
  if (key.includes('security')) {
    return { icon: Shield, accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' };
  }
  if (key.includes('usuarios')) {
    return { icon: Users, accent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' };
  }
  if (key.includes('activity')) {
    return { icon: Activity, accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' };
  }
  return { icon: FileText, accent: 'bg-slate-500/10 text-slate-700 dark:text-slate-200' };
}

export function ManualHeader({ title, description, backHref, backLabel }: ManualHeaderProps) {
  const visual = resolveVisual(backHref);
  const Icon = visual.icon as LucideIcon;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-3xl border border-white/70 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5',
            visual.accent,
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
