'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

/** Radix Select não permite `value=""` em `SelectItem`; usamos este valor interno e mapeamos para string vazia. */
const SELECT_EMPTY_SENTINEL = '__atlas_filter_all__';

export type FilterField = {
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type DataFiltersProps = {
  fields: FilterField[];
  onFilter: (values: Record<string, string>) => void;
  onClear?: () => void;
};

export function DataFilters({ fields, onFilter, onClear }: DataFiltersProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter(values);
  };

  const handleClear = () => {
    setValues({});
    onFilter({});
    onClear?.();
  };

  const hasValues = Object.values(values).some((v) => v?.trim());

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {fields.map((field) => (
        <div key={field.key} className="min-w-[140px] max-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            {field.label}
          </label>
          {field.type === 'text' ? (
            <Input
              placeholder={field.placeholder ?? `Filtrar por ${field.label}`}
              value={values[field.key] ?? ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="h-9 rounded-lg"
            />
          ) : (
            <Select
              value={
                values[field.key] === undefined || values[field.key] === ''
                  ? values[field.key] === ''
                    ? SELECT_EMPTY_SENTINEL
                    : undefined
                  : values[field.key]
              }
              onValueChange={(v) =>
                setValues((prev) => ({
                  ...prev,
                  [field.key]: v === SELECT_EMPTY_SENTINEL ? '' : v,
                }))
              }
            >
              <SelectTrigger className="h-9 rounded-lg">
                <SelectValue placeholder={field.placeholder ?? field.label} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((opt) => {
                  const itemValue = opt.value === '' ? SELECT_EMPTY_SENTINEL : opt.value;
                  return (
                    <SelectItem key={itemValue} value={itemValue}>
                      {opt.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-9 rounded-lg">
          <Search className="mr-1 h-4 w-4" />
          Filtrar
        </Button>
        {hasValues && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            onClick={handleClear}
          >
            <X className="mr-1 h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>
    </form>
  );
}
