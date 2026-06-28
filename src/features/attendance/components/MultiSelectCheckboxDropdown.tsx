import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectCheckboxDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}

export const MultiSelectCheckboxDropdown: React.FC<MultiSelectCheckboxDropdownProps> = ({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = 'Chọn...',
  disabled = false,
  emptyText = 'Chưa có dữ liệu',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const selectedLabels = options
    .filter((opt) => selectedIds.has(opt.id))
    .map((opt) => opt.label);

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.length} mục đã chọn`;

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-xs font-medium uppercase text-gray-500">{label}</label>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${selectedLabels.length === 0 ? 'text-gray-400' : ''}`}>
          {options.length === 0 ? emptyText : summary}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && options.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(opt.id)}
                onChange={() => toggle(opt.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                {opt.sublabel && (
                  <span className="block text-xs text-gray-500">{opt.sublabel}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
