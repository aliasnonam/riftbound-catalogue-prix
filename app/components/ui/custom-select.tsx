"use client";

import { useEffect, useId, useRef, useState } from "react";

type CustomSelectOption = {
  value: string;
  label: string;
};

export function CustomSelect({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly CustomSelectOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return <div className={`custom-select ${className}`} ref={rootRef}>
    <span className="custom-select-label">{label}</span>
    <button
      type="button"
      className="custom-select-trigger"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <span>{selected?.label}</span>
      <i aria-hidden="true">⌄</i>
    </button>
    {open ? <div id={menuId} className="custom-select-menu" role="listbox" aria-label={label}>
      {options.map((option) => <button
        type="button"
        key={option.value}
        role="option"
        aria-selected={option.value === value}
        className={option.value === value ? "is-selected" : ""}
        onClick={() => choose(option.value)}
      >
        {option.label}
      </button>)}
    </div> : null}
  </div>;
}
