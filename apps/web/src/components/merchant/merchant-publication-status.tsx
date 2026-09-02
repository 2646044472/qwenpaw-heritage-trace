import { CheckCircle2, CircleDot, LoaderCircle } from "lucide-react";

export type PublicationFlowState = "idle" | "generating" | "ready" | "publishing" | "published" | "failed";

type MerchantPublicationStatusProps = {
  state: PublicationFlowState;
  postId: string | null;
  publishedAt: string | null;
};

const steps: { id: string; state: PublicationFlowState; label: string }[] = [
  { id: "draft", state: "ready", label: "內容草稿" },
  { id: "confirm", state: "publishing", label: "商戶確認" },
  { id: "publish", state: "published", label: "發佈成功" },
];

const progressIndex: Record<PublicationFlowState, number> = {
  idle: -1,
  generating: -1,
  ready: 0,
  publishing: 1,
  published: 2,
  failed: 0,
};

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Macau",
  }).format(new Date(value));
}

export function MerchantPublicationStatus({ state, postId, publishedAt }: MerchantPublicationStatusProps) {
  const current = progressIndex[state];

  return (
    <div aria-live="polite" className="border-heritage-border border-t pt-4">
      <ol
        aria-label="發佈進度"
        className="flex flex-wrap items-center gap-x-2 gap-y-2 text-muted-foreground text-xs"
      >
        {steps.map((step, index) => {
          const complete = current > index || state === "published";
          const active = current === index && state !== "published";

          return (
            <li className="flex items-center gap-2" key={step.id}>
              {index > 0 ? (
                <span aria-hidden="true" className="text-heritage-gold-foreground/60">
                  →
                </span>
              ) : null}
              <span className={complete || active ? "font-medium text-foreground" : undefined}>
                {complete ? (
                  <CheckCircle2 aria-hidden="true" className="mr-1 inline size-3.5 text-heritage-success" />
                ) : null}
                {active ? <CircleDot aria-hidden="true" className="mr-1 inline size-3.5 text-heritage-gold" /> : null}
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {state === "generating" ? (
        <p className="mt-3 flex items-center gap-2 text-foreground/80 text-sm">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-heritage" />
          正在整理已核實文化資料
        </p>
      ) : null}
      {state === "publishing" ? (
        <p className="mt-3 flex items-center gap-2 text-foreground/80 text-sm">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-heritage" />
          正在發佈
        </p>
      ) : null}
      {state === "failed" ? <p className="mt-3 text-destructive text-sm">發佈未完成，請稍後再試。</p> : null}
      {state === "published" ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-heritage-success text-sm">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          <span>發佈成功</span>
          {postId && publishedAt ? (
            <span className="text-muted-foreground">
              {postId} · {formatPublishedAt(publishedAt)}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
