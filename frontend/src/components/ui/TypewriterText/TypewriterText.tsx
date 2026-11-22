"use client";

import { useTypewriterLoop } from "@/hooks/useTypewriterLoop";

export interface TypewriterTextProps {
  texts: readonly string[];
  paused?: boolean;
  typingMs?: number;
  deletingMs?: number;
  holdMs?: number;
  className?: string;
  cursorClassName?: string;
  accessibleText?: string;
}

export function TypewriterText({
  texts,
  paused,
  typingMs,
  deletingMs,
  holdMs,
  className = "",
  cursorClassName = "",
  accessibleText,
}: TypewriterTextProps) {
  const { text, isAnimating, reducedMotion } = useTypewriterLoop({ texts, paused, typingMs, deletingMs, holdMs });
  const readableText = accessibleText ?? texts.find((message) => message.length > 0) ?? "";
  const cursor = "ml-[0.06em] inline-block h-[0.9em] w-[0.065em] translate-y-[0.08em] bg-current";

  return (
    <span data-typewriter className={`relative inline-grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] align-baseline ${className}`}>
      <span className="sr-only">{readableText}</span>
      {texts.map((message, index) => (
        <span key={`${index}-${message}`} aria-hidden="true" className="invisible col-start-1 row-start-1 min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {message}<span className={cursor} />
        </span>
      ))}
      <span aria-hidden="true" data-typewriter-text className="col-start-1 row-start-1 min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {text}
        {readableText && !reducedMotion && <span data-typewriter-cursor className={`${cursor} ${isAnimating ? "motion-safe:animate-pulse" : ""} ${cursorClassName}`} />}
      </span>
    </span>
  );
}
