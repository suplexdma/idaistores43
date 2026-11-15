import type { ReactNode } from "react";

function renderInline(value: string): ReactNode[] {
  const fragments = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return fragments.map((fragment, index) => {
    if (fragment.startsWith("**") && fragment.endsWith("**")) {
      return <strong key={index}>{fragment.slice(2, -2)}</strong>;
    }
    if (fragment.startsWith("*") && fragment.endsWith("*")) {
      return <em key={index}>{fragment.slice(1, -1)}</em>;
    }
    return fragment;
  });
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  return (
    <div className="space-y-4 leading-8">
      {lines.map((line, index) => {
        if (!line.trim()) return null;
        if (line.startsWith("### ")) return <h3 key={index} className="text-xl font-semibold">{renderInline(line.slice(4))}</h3>;
        if (line.startsWith("## ")) return <h2 key={index} className="text-2xl font-semibold">{renderInline(line.slice(3))}</h2>;
        if (line.startsWith("# ")) return <h2 key={index} className="text-3xl font-semibold">{renderInline(line.slice(2))}</h2>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <ul key={index} className="list-disc ps-6"><li>{renderInline(line.slice(2))}</li></ul>;
        }
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
