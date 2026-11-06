'use client';

import { Button } from '@/components/ui/button';
import { ACTION_COPY, actionDeleteOutlineClassName } from '@/lib/ui/action-copy';
import { cn } from '@/lib/utils';

type EntityEditDeleteActionsProps = {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Par padrão Editar / Excluir em cartões de listagem.
 * «Excluir» usa outline destrutivo para não parecer um segundo «Cancelar».
 */
export function EntityEditDeleteActions({
  onEdit,
  onDelete,
  disabled,
  className,
}: EntityEditDeleteActionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onEdit}>
        {ACTION_COPY.edit}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className={actionDeleteOutlineClassName}
        onClick={onDelete}
      >
        {ACTION_COPY.delete}
      </Button>
    </div>
  );
}
