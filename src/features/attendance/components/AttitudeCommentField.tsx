import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Tag } from 'lucide-react';
import {
  ATTITUDE_COMMENT_TAGS,
  appendAttitudeTag,
} from '../../../utils/attitudeCommentTags';

interface AttitudeCommentFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const AttitudeCommentField: React.FC<AttitudeCommentFieldProps> = ({
  value,
  onChange,
  disabled = false,
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

  const handleSelectTag = (tag: string) => {
    onChange(appendAttitudeTag(value, tag));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative min-w-[180px]">
      <div className="mb-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-left text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex items-center gap-1 truncate">
            <Tag size={12} className="shrink-0" />
            Chọn thẻ nhanh
          </span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {ATTITUDE_COMMENT_TAGS.map((tag) => {
              const selected = value
                .split('\n')
                .some(
                  (line) =>
                    line.replace(/^\d+\.\s*/, '').trim().toLowerCase() === tag.toLowerCase()
                );
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSelectTag(tag)}
                  className={`block w-full px-3 py-2 text-left text-xs hover:bg-amber-50 ${
                    selected ? 'bg-green-50 font-medium text-green-800' : 'text-gray-700'
                  }`}
                >
                  {tag}
                  {selected && <span className="ml-1 text-green-600">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <textarea
        placeholder="Nhận xét ý thức... (Enter để xuống dòng)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        className="w-full border-b border-gray-200 bg-transparent py-1 text-gray-600 outline-none resize-y focus:border-indigo-500 disabled:opacity-50"
      />
    </div>
  );
};
