// ===================================
// フォームフィールド共通コンポーネント
// ===================================
// ラベル + 入力欄 のセットを統一的に描画

import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  error?: string;
  hint?: string;
}

export function FormField({ label, required = false, children, error, hint }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-stone-700 flex items-center gap-1">
        {label}
        {required && (
          <span className="text-matsuri-500 text-xs font-bold">必須</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-stone-400 mt-0.5">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-matsuri-500 font-medium mt-0.5 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
