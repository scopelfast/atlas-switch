/** Catálogo inicial de categorias de custo Projectus (por equipa). `code` estável para relatórios. */
export const DEFAULT_PROJECTUS_COST_CATEGORIES: readonly { code: string; label: string; position: number }[] = [
  { code: 'PESSOAL', label: 'Pessoal e encargos', position: 10 },
  { code: 'SOFTWARE', label: 'Software e licenças', position: 20 },
  { code: 'INFRA', label: 'Infraestrutura e cloud', position: 30 },
  { code: 'VIAGENS', label: 'Viagens e estadias', position: 40 },
  { code: 'CONSULTORIA', label: 'Consultoria externa', position: 50 },
  { code: 'MATERIAL', label: 'Material e equipamento', position: 60 },
  { code: 'IMPOSTOS', label: 'Impostos e taxas', position: 70 },
  { code: 'PLANEJAMENTO', label: 'Planejamento e levantamento', position: 80 },
  { code: 'OPERACIONAL', label: 'Operacional', position: 90 },
  { code: 'OUTROS', label: 'Outros', position: 100 },
] as const;
