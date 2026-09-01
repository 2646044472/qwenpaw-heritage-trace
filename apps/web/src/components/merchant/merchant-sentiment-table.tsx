import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ShopSignals } from "@/lib/heritage/application-types";
import type { SentimentSignalRecord } from "@/lib/heritage/merchant-telemetry-types";

const sentimentLabels = { positive: "正面", mixed: "中性", negative: "負面" } as const;
const sentimentStyles = {
  positive: "bg-heritage-success-surface text-heritage-success",
  mixed: "bg-heritage-soft text-heritage-gold-foreground",
  negative: "bg-destructive/10 text-destructive",
} as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Macau" }).format(
    new Date(value),
  );
}

function scoreClass(score: number) {
  if (score > 0.4) return "text-heritage-success";
  if (score < 0) return "text-destructive";
  return "text-heritage-gold-foreground";
}

export function MerchantSentimentTable({
  signals,
  records,
}: {
  signals: ShopSignals;
  records: SentimentSignalRecord[];
}) {
  return (
    <section
      aria-labelledby="sentiment-signals-heading"
      className="rounded-2xl border border-heritage-border bg-heritage-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heritage-display font-semibold text-xl" id="sentiment-signals-heading">
            情緒訊號
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">來自訪客公開回應的整合觀察</p>
        </div>
        <Badge className={sentimentStyles[signals.sentiment.label]}>
          {sentimentLabels[signals.sentiment.label]} {signals.sentiment.score.toFixed(2)}
        </Badge>
      </div>
      <p className="mt-3 rounded-lg bg-heritage-soft px-3 py-2 text-heritage-gold-foreground text-sm">
        整體訊號：{signals.sentiment.summary}
      </p>
      {records.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">暫無事件</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>時間</TableHead>
                <TableHead>來源渠道</TableHead>
                <TableHead>情緒</TableHead>
                <TableHead>評分</TableHead>
                <TableHead>來源數</TableHead>
                <TableHead>摘錄</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{formatTime(record.occurred_at)}</TableCell>
                  <TableCell>{record.channel}</TableCell>
                  <TableCell>
                    <Badge className={sentimentStyles[record.label]}>{sentimentLabels[record.label]}</Badge>
                  </TableCell>
                  <TableCell className={scoreClass(record.score)}>{record.score.toFixed(2)}</TableCell>
                  <TableCell>{record.source_count}</TableCell>
                  <TableCell className="max-w-sm whitespace-normal">{record.excerpt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
