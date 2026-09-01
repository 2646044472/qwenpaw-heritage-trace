import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExposureEvent } from "@/lib/heritage/merchant-telemetry-types";

const eventLabels: Record<ExposureEvent["event_type"], string> = {
  impression: "曝光",
  detail_view: "查看詳情",
  save: "收藏",
  route_add: "加入路線",
};

const deviceLabels: Record<ExposureEvent["device"], string> = {
  mobile: "手機",
  desktop: "桌面裝置",
  tablet: "平板裝置",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Macau" }).format(
    new Date(value),
  );
}

export function MerchantExposureLog({ events }: { events: ExposureEvent[] }) {
  return (
    <section
      aria-labelledby="exposure-events-heading"
      className="rounded-2xl border border-heritage-border bg-heritage-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heritage-display font-semibold text-xl" id="exposure-events-heading">
            曝光事件
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">訪客接觸店舖資料的記錄</p>
        </div>
        <Badge className="border-heritage-border bg-heritage-soft text-heritage-gold-foreground" variant="outline">
          IP 已匿名化
        </Badge>
      </div>
      {events.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">暫無事件</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>時間</TableHead>
                <TableHead>IP 位址</TableHead>
                <TableHead>轉介來源</TableHead>
                <TableHead>裝置</TableHead>
                <TableHead>頁面</TableHead>
                <TableHead>事件</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{formatTime(event.occurred_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{event.ip_address}</TableCell>
                  <TableCell>{event.referrer}</TableCell>
                  <TableCell>{deviceLabels[event.device]}</TableCell>
                  <TableCell className="font-mono text-xs">{event.route}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{eventLabels[event.event_type]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
