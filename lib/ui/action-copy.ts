/**
 * Nomenclatura canónica (PT) para acções repetidas no dashboard.
 * Evita misturar «Guardar»/«Salvar», «Apagar»/«Excluir»/«Eliminar» entre módulos.
 */
export const ACTION_COPY = {
  edit: 'Editar',
  /** Remoção definitiva de registo (não usar «Apagar» em UI nova). */
  delete: 'Excluir',
  cancel: 'Cancelar',
  save: 'Salvar',
  saving: 'Salvando…',
  deleting: 'A excluir…',
  add: 'Adicionar',
  create: 'Criar',
  clear: 'Limpar',
  /** Frases compostas usadas em formulários específicos. */
  saveMeeting: 'Salvar reunião',
} as const;

/**
 * Ênfase visual para «Excluir» em listas (outline + vermelho suave).
 * Usar com `<Button variant="outline" className={actionDeleteOutlineClassName} />`.
 */
export const actionDeleteOutlineClassName =
  'border-rose-300/90 text-rose-800 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-100 dark:hover:bg-rose-950/50';
