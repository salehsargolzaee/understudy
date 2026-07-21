import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// remark-math + rehype-katex render $…$ and $$…$$; remark-gfm renders tables.
const Writeup = memo(function Writeup({ markdown }: { markdown: string }) {
  return (
    <div className="writeup">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        components={{
          table: ({ children }) => <div className="overflow-x-auto">{<table>{children}</table>}</div>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
});

export default Writeup;
