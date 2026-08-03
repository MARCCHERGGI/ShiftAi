"use client";

import { useId } from "react";

interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

export default function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: TextFieldProps) {
  const id = useId();

  return (
    <div className="textfield">
      {label ? (
        <label className="textfield__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {multiline ? (
        <textarea
          id={id}
          className="textfield__input"
          value={value}
          placeholder={placeholder}
          rows={5}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="textfield__input"
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export { TextField };
