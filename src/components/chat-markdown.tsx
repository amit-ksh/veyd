"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          h1: ({ children }) => <h2>{children}</h2>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="chat-table-scroll">
              <table>{children}</table>
            </div>
          ),
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
