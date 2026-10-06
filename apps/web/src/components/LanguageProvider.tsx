"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { translateText, type AppLanguage } from "@stc-foundit/shared";

type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "stc-foundit-language";
const LANGUAGE_EVENT = "stc-foundit-language-change";
const textOrigins = new WeakMap<Text, { original: string; rendered: string }>();
const attributeOrigins = new WeakMap<Element, Map<string, { original: string; rendered: string }>>();

function getLanguageSnapshot(): AppLanguage {
  return window.localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
}

function subscribeToLanguage(callback: () => void) {
  window.addEventListener(LANGUAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function applyDocumentLanguage(language: AppLanguage) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (textNode.parentElement?.closest("script,style,noscript,textarea,[data-no-translate]")) continue;
    const current = textNode.nodeValue ?? "";
    let entry = textOrigins.get(textNode);
    if (!entry) {
      entry = { original: current, rendered: current };
      textOrigins.set(textNode, entry);
    } else if (current !== entry.rendered) {
      entry.original = current;
    }
    const next = translateText(entry.original, language);
    if (current !== next) textNode.nodeValue = next;
    entry.rendered = next;
  }

  const elements = document.body.querySelectorAll<HTMLElement>("[placeholder],[aria-label],[title]");
  for (const element of elements) {
    let records = attributeOrigins.get(element);
    if (!records) { records = new Map(); attributeOrigins.set(element, records); }
    for (const name of ["placeholder", "aria-label", "title"]) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      let entry = records.get(name);
      if (!entry) { entry = { original: current, rendered: current }; records.set(name, entry); }
      else if (current !== entry.rendered) entry.original = current;
      const next = translateText(entry.original, language);
      if (current !== next) element.setAttribute(name, next);
      entry.rendered = next;
    }
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, (): AppLanguage => "en");

  const setLanguage = useCallback((next: AppLanguage) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, []);

  useEffect(() => {
    applyDocumentLanguage(language);
    const observer = new MutationObserver(() => applyDocumentLanguage(language));
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useSiteLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useSiteLanguage must be used inside LanguageProvider");
  return value;
}

export function LanguageSelect() {
  const { language, setLanguage } = useSiteLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(next: AppLanguage) {
    setLanguage(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const options = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[nextIndex]?.focus();
  }

  return (
    <div className="language-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="language-trigger"
        aria-label="Choose language"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="language-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <svg className="language-globe" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
        <span className="language-trigger-title">Language</span>
        <span className="language-current">{language === "ar" ? "العربية" : "English"}</span>
        <svg className={`language-chevron ${open ? "language-chevron-open" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && (
        <div id="language-menu" ref={menuRef} className="language-menu" role="menu" aria-label="Choose language" onKeyDown={handleMenuKeyDown}>
          <p className="language-menu-heading">Choose language</p>
          <button type="button" role="menuitemradio" aria-checked={language === "en"} className={`language-option ${language === "en" ? "language-option-selected" : ""}`} onClick={() => choose("en")}>
            <span className="language-code">EN</span><span className="language-option-name">English<span className="language-option-detail">English</span></span><span className="language-check" aria-hidden="true">{language === "en" ? "✓" : ""}</span>
          </button>
          <button type="button" role="menuitemradio" aria-checked={language === "ar"} className={`language-option ${language === "ar" ? "language-option-selected" : ""}`} onClick={() => choose("ar")}>
            <span className="language-code language-code-ar">ع</span><span className="language-option-name" lang="ar">العربية<span className="language-option-detail">Arabic</span></span><span className="language-check" aria-hidden="true">{language === "ar" ? "✓" : ""}</span>
          </button>
        </div>
      )}
    </div>
  );
}
