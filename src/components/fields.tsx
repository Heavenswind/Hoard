import { useState, type InputHTMLAttributes } from 'react';

type Native = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

/**
 * A number field that lets you type freely ("", "-", "1.") and only reports values that parse.
 * While focused it shows your text; otherwise it shows the stored value.
 */
export function NumberInput({ value, onChange, ...rest }: Native & { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...rest}
      type="number"
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function TextInput({ value, onChange, ...rest }: Native & { value: string; onChange: (s: string) => void }) {
  return <input {...rest} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
}
