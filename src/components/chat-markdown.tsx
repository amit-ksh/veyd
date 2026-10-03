"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, ExternalLink } from "lucide-react";

function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const codeString = String(children).replace(/\n$/, "");

  // Inline code check
  const isInline = !match && !codeString.includes("\n");
  if (isInline) {
    return (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800" {...props}>
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-slate-100 text-xs shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3.5 py-1.5">
        <span className="font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-slate-200">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function ChatMarkdown({
  text,
  user = false,
}: {
  text: string;
  user?: boolean;
}) {
  return (
    <div className={`chat-prose ${user ? "chat-prose-user" : ""}`}>
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="text-base font-bold text-slate-900 mt-4 mb-2 first:mt-0 tracking-tight">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-xs font-semibold text-slate-800 mt-2.5 mb-1">
              {children}
            </h4>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-[#008f96] hover:text-[#00747b] underline underline-offset-3"
            >
              <span>{children}</span>
              <ExternalLink className="inline h-2.5 w-2.5 ml-0.5 opacity-70" />
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
              <div className="chat-table-scroll overflow-x-auto">
                <table className="w-full text-xs text-left">{children}</table>
              </div>
            </div>
          ),
          code: CodeBlock as any,
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
