import { Badge } from "@/components/ui/badge";
import type { PublicationEvent } from "@/lib/heritage/merchant-telemetry-types";

const statusLabels = { draft: "草稿", confirmed: "已確認", published: "模擬已發佈" } as const;

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Macau" }).format(
    new Date(value),
  );
}

export function MerchantPublicationPanel({ publication }: { publication: PublicationEvent }) {
  return (
    <section
      aria-labelledby="publication-heading"
      className="rounded-2xl border border-heritage-border bg-heritage-surface p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heritage-display font-semibold text-xl" id="publication-heading">
            Demo 內容表現
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">固定 Demo 訊號；不會發布到社交平台</p>
        </div>
        <Badge
          className={
            publication.status === "published"
              ? "bg-heritage-success-surface text-heritage-success"
              : "bg-heritage-soft text-heritage-gold-foreground"
          }
        >
          {statusLabels[publication.status]}
        </Badge>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Demo 內容 ID</dt>
          <dd className="mt-1 font-mono">{publication.post_id ?? "尚未建立"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">模擬發佈時間</dt>
          <dd className="mt-1">{formatTime(publication.published_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">曝光</dt>
          <dd className="mt-1 font-semibold text-lg">{publication.metrics.impressions}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">收藏</dt>
          <dd className="mt-1 font-semibold text-lg">{publication.metrics.saves}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">留言</dt>
          <dd className="mt-1 font-semibold text-lg">{publication.metrics.comments}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">建立時間</dt>
          <dd className="mt-1">{formatTime(publication.created_at)}</dd>
        </div>
      </dl>
    </section>
  );
}
