import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getDemoHeritageShop } from "@/lib/heritage/demo-seeds";
import { getMerchantTelemetry } from "@/lib/heritage/merchant-telemetry-fixtures";

import { MerchantDataConsole } from "./merchant-data-console";

describe("MerchantDataConsole", () => {
  it("renders shop-keyed telemetry in semantic merchant tables", () => {
    const shop = getDemoHeritageShop("lei-kei-001");
    const telemetry = getMerchantTelemetry(shop.shop_id);

    render(<MerchantDataConsole shop={shop} telemetry={telemetry} />);

    expect(screen.getByRole("heading", { name: "商戶數據後台" })).toBeVisible();
    expect(screen.getByText(shop.shop_id)).toBeVisible();
    expect(screen.getByRole("heading", { name: "曝光事件" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "情緒訊號" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Demo 內容表現" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "文化資料核實檔案" })).toBeVisible();

    const metrics = screen.getByLabelText("關鍵指標");
    expect(within(metrics).getByText("曝光記錄")).toBeVisible();
    expect(within(metrics).getByText("情緒訊號")).toBeVisible();

    const tables = screen.getAllByRole("table");
    expect(within(tables[0]).getByRole("columnheader", { name: "時間" })).toBeVisible();
    expect(within(tables[0]).getByRole("columnheader", { name: "IP 位址" })).toBeVisible();
    expect(within(tables[0]).getByRole("columnheader", { name: "事件" })).toBeVisible();
    expect(within(tables[1]).getByRole("columnheader", { name: "來源渠道" })).toBeVisible();
    expect(within(tables[1]).getByRole("columnheader", { name: "評分" })).toBeVisible();
    expect(screen.getByText("IP 已匿名化")).toBeVisible();
    expect(tables[0].compareDocumentPosition(tables[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows explicit empty states when telemetry lists have no records", () => {
    const shop = getDemoHeritageShop("lei-kei-001");
    const telemetry = { ...getMerchantTelemetry(shop.shop_id), exposure_events: [], sentiment_signals: [] };

    render(<MerchantDataConsole shop={shop} telemetry={telemetry} />);

    expect(screen.getAllByText("暫無事件")).toHaveLength(2);
  });

  it("shows a loading state without inventing an error contract", () => {
    const shop = getDemoHeritageShop("lei-kei-001");
    const telemetry = getMerchantTelemetry(shop.shop_id);

    render(<MerchantDataConsole isLoading shop={shop} telemetry={telemetry} />);

    expect(screen.getByRole("status")).toHaveTextContent("正在載入商戶資料");
  });
});
