"use client";

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function MessageContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_PATTERN.exec(content)) !== null) {
    const [, label, url] = match;
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));

    let safeUrl: URL | null = null;
    try {
      safeUrl = new URL(url);
    } catch {
      safeUrl = null;
    }

    parts.push(safeUrl && (safeUrl.protocol === "https:" || safeUrl.protocol === "http:")
      ? <a key={`link-${match.index}`} href={safeUrl.href} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">{label}</a>
      : match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return <>{parts.length ? parts : content}</>;
}
