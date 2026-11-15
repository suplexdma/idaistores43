"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Underline as UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder: string;
};

export function RichTextEditor({ label, value, onChange, maxLength, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      CharacterCount.configure({ limit: maxLength }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
    editorProps: {
      attributes: {
        "aria-label": label,
        class: "min-h-28 px-3 py-2 text-sm leading-6 outline-none",
        "data-placeholder": placeholder,
      },
    },
  });

  if (!editor) {
    return <div aria-label={label} className="min-h-36 animate-pulse rounded-md border bg-muted/30" />;
  }

  const actions = [
    { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Underline", icon: UnderlineIcon, active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Bulleted list", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-brand-olive/20">
      <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap gap-1 border-b bg-muted/30 p-1.5">
        {actions.map(({ label: actionLabel, icon: Icon, active, run }) => (
          <Button
            key={actionLabel}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            aria-label={actionLabel}
            aria-pressed={active}
            onClick={run}
          >
            <Icon aria-hidden="true" className="size-4" />
          </Button>
        ))}
        <span className="ml-auto self-center px-2 text-xs text-muted-foreground" aria-live="polite">
          {editor.storage.characterCount.characters()}/{maxLength}
        </span>
      </div>
      <EditorContent editor={editor} className="[&_.tiptap]:min-h-28 [&_.tiptap]:max-h-80 [&_.tiptap]:overflow-y-auto [&_.tiptap]:focus:outline-none [&_p]:my-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1" />
    </div>
  );
}
