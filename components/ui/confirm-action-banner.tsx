import { Button } from '@/components/ui/button';

type ConfirmActionBannerProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmActionBanner({
  open,
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmActionBannerProps) {
  if (!open) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
