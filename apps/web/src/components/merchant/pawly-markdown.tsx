import type { ReactNode } from "react";

function inlineMarkdown(text: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  return text.split(tokenPattern).map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("__") && token.endsWith("__")) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code className="rounded bg-heritage-soft px-1.5 py-0.5 font-mono text-[0.9em]" key={`${token}-${index}`}>
          {token.slice(1, -1)}
        </code>
      );
    }
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      return <em key={`${token}-${index}`}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

export function PawlyMarkdown({ children }: { children: string }) {
  const lines = children.replaceAll("\r", "").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`paragraph-${blocks.length}`}>
        {inlineMarkdown(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const ListTag = list.ordered ? "ol" : "ul";
    blocks.push(
      <ListTag className={list.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"} key={`list-${blocks.length}`}>
        {list.items.map((item, index) => <li key={`${item}-${index}`}>{inlineMarkdown(item)}</li>)}
      </ListTag>,
    );
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);

    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const HeadingTag = heading[1].length === 1 ? "h3" : "h4";
      blocks.push(
        <HeadingTag className="font-heritage-display font-semibold text-base" key={`heading-${blocks.length}`}>
          {inlineMarkdown(heading[2])}
        </HeadingTag>,
      );
    } else if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((ordered ?? unordered)?.[1] ?? "");
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-3">{blocks}</div>;
}
