"use client";

import { useEffect, useRef, useState } from "react";

const universities = ["Kasdi Merbah University", "Other University"] as const;

export function UniversitySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="university-select" ref={rootRef}>
      <button ref={triggerRef} type="button" className="university-trigger" aria-label="Choose university" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className={value ? "" : "university-placeholder"}>{value || "Select a university"}</span>
        <svg className={`university-chevron ${open ? "university-chevron-open" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && <div className="university-menu" role="listbox" aria-label="Choose university">
        {universities.map((university) => (
          <button key={university} type="button" role="option" aria-selected={value === university} className={`university-option ${value === university ? "university-option-selected" : ""}`} onClick={() => { onChange(university); setOpen(false); triggerRef.current?.focus(); }}>
            <span>{university}</span><span className="university-check" aria-hidden="true">{value === university ? "✓" : ""}</span>
          </button>
        ))}
      </div>}
    </div>
  );
}
