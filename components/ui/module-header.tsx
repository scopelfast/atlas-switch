import { cn } from "@/lib/utils"
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
  Plug,
  type LucideIcon
} from "lucide-react"

type ModuleHeaderProps = {
  title: string
  description?: string
  eyebrow?: string
  className?: string
  showIcon?: boolean
}

/**
 * Cabecalho padrao para modulos com visual consistente.
 */
export function ModuleHeader({
  title,
  description,
  eyebrow = "AtlasSwitch",
  className,
  showIcon = true
}: ModuleHeaderProps) {
  const key = title.toLowerCase()
  const visual =
    key.includes("taskflow")
      ? { icon: CheckSquare, accent: "bg-violet-500/10 text-violet-600 dark:text-violet-300" }
      : key.includes("chronos")
        ? { icon: CalendarClock, accent: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" }
        : key.includes("reunify")
          ? { icon: Video, accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" }
          : key.includes("projectus")
            ? { icon: Briefcase, accent: "bg-amber-500/10 text-amber-600 dark:text-amber-300" }
            : key.includes("resourcehub")
              ? { icon: Boxes, accent: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300" }
              : key.includes("billtrak")
                ? { icon: CreditCard, accent: "bg-rose-500/10 text-rose-600 dark:text-rose-300" }
                : key.includes("bibliotheca")
                  ? { icon: Library, accent: "bg-violet-500/10 text-violet-600 dark:text-violet-300" }
                  : key.includes("notepad")
                    ? { icon: NotebookPen, accent: "bg-sky-500/10 text-sky-600 dark:text-sky-300" }
                      : key.includes("scriptum")
                      ? { icon: FilePenLine, accent: "bg-orange-500/10 text-orange-600 dark:text-orange-300" }
                      : key.includes("integrações")
                        ? { icon: Plug, accent: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" }
                      : key.includes("control center")
                        ? { icon: ShieldCheck, accent: "bg-slate-500/10 text-slate-700 dark:text-slate-200" }
                        : key.includes("central de ia") || key.includes("ia")
                          ? { icon: Brain, accent: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300" }
                          : key.includes("configurações") || key.includes("configuracoes")
                            ? { icon: Settings, accent: "bg-slate-500/10 text-slate-700 dark:text-slate-200" }
                            : key.includes("segurança") || key.includes("seguranca")
                              ? { icon: Shield, accent: "bg-rose-500/10 text-rose-600 dark:text-rose-300" }
                              : key.includes("atividade")
                                ? { icon: Activity, accent: "bg-amber-500/10 text-amber-600 dark:text-amber-300" }
                                : key.includes("usuários") || key.includes("usuarios")
                                  ? { icon: Users, accent: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" }
                                  : null
  const Icon = (visual?.icon ?? null) as LucideIcon | null

  return (
    <div className={cn("atlas-surface relative overflow-hidden p-6", className)}>
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="absolute -left-12 bottom-0 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500/90 dark:text-indigo-300">
          {eyebrow}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </div>
        {Icon && showIcon ? (
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-3xl border border-white/70 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
              visual?.accent
            )}
          >
            <Icon className="h-8 w-8" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
