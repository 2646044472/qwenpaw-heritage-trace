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

function buildSentimentAnalysis(records: SentimentSignalRecord[]) {
  if (records.length === 0) return null;

  const counts = records.reduce(
    (result, record) => {
      result[record.label] += 1;
      return result;
    },
    { positive: 0, mixed: 0, negative: 0 },
  );
  const channelCounts = records.reduce<Record<string, number>>((result, record) => {
    result[record.channel] = (result[record.channel] ?? 0) + 1;
    return result;
  }, {});
  const primaryChannel = Object.entries(channelCounts).sort(([, left], [, right]) => right - left)[0]?.[0] ?? "公開渠道";
  let channelObservation = "旅遊平台上的回應顯示，這間店已被納入旅客的行程考量。";
  if (primaryChannel === "小紅書") channelObservation = "小紅書上的分享帶來最多討論。";
  if (primaryChannel === "Google 評論") channelObservation = "Google 評論反映出訪客對實際到訪體驗的感受。";

  if (counts.positive >= counts.mixed + counts.negative) {
    return `訪客整體反應正面，最欣賞店舖故事與招牌產品。${channelObservation}目前最值得改善的是營業時間和位置資訊，寫得更清楚會更方便旅客到訪。`;
  }
  if (counts.negative > counts.positive) {
    return `訪客對店舖的印象較為保留，主要疑問落在營業資訊和到訪體驗。${channelObservation}建議先把基礎資訊補齊，再推出新的宣傳內容。`;
  }
  return `訪客反應不一，大家認同店舖的特色，但到訪前仍需要更多清晰資訊。${channelObservation}補充營業時間、地圖位置和產品介紹，有助於把興趣變成實際到訪。`;
}

export function MerchantSentimentTable({
  signals,
  records,
}: {
  signals: ShopSignals;
  records: SentimentSignalRecord[];
}) {
  const analysis = buildSentimentAnalysis(records);

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
        {analysis ?? signals.sentiment.summary}
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
