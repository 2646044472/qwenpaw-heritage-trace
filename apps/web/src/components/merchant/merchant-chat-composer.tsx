import { ArrowUp } from "lucide-react";

export function MerchantChatComposer({
  disabled,
  onChange,
  onSend,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  value: string;
}) {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      aria-label="與 Pawly 對話"
      className="flex items-center gap-2 border-heritage-border border-t bg-heritage-soft px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <label className="sr-only" htmlFor="merchant-chat-input">
        想問 Pawly？
      </label>
      <input
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-heritage-border bg-heritage-surface px-4 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-heritage"
        disabled={disabled}
        id="merchant-chat-input"
        onChange={(event) => onChange(event.target.value)}
        placeholder="想問 Pawly？"
        value={value}
      />
      <button
        aria-label="發送訊息"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-heritage text-heritage-foreground transition hover:bg-heritage/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!canSend}
        type="submit"
      >
        <ArrowUp aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}
