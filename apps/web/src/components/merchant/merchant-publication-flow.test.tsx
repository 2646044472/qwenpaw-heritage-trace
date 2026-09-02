import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getDemoHeritageShop } from "@/lib/heritage/demo-seeds";

import { DemoStateProvider } from "../demo/demo-state-provider";
import { MerchantPawly } from "./merchant-pawly";

describe("Merchant Pawly publication flow", () => {
  afterEach(() => vi.useRealTimers());

  it("offers a direct Xiaohongshu demo preview from the opening screen", () => {
    vi.useFakeTimers();
    render(
      <DemoStateProvider initialShopId="lei-kei-001">
        <MerchantPawly shop={getDemoHeritageShop("lei-kei-001")} />
      </DemoStateProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "幫我生成小紅書內容" }));
    expect(screen.getByText("Pawly 正在整理已核實資料")).toBeVisible();
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole("heading", { name: "小紅書草稿" })).toBeVisible();
  });

  it("hides one-click publishing until the workflow marks the story publishable", () => {
    vi.useFakeTimers();
    render(
      <DemoStateProvider initialShopId="mok-yi-kei-008">
        <MerchantPawly shop={getDemoHeritageShop("mok-yi-kei-008")} />
      </DemoStateProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "幫我生成小紅書內容" }));
    act(() => vi.advanceTimersByTime(650));
    expect(screen.queryByRole("button", { name: "一鍵發佈" })).not.toBeInTheDocument();
    expect(screen.getByText("完成資料核實後即可發佈。")).toBeVisible();
  });

  it("shows completion without fabricating a telemetry receipt", () => {
    vi.useFakeTimers();
    render(
      <DemoStateProvider initialShopId="lei-kei-001">
        <MerchantPawly shop={getDemoHeritageShop("lei-kei-001")} />
      </DemoStateProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "最近鋪頭點啊？" }));
    act(() => vi.advanceTimersByTime(700));
    expect(within(screen.getByLabelText("老闆 訊息")).getByText("最近鋪頭點啊？")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "市民評價" }));
    expect(screen.getByText("正在整理固定 Demo 評價訊號")).toBeVisible();
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "點樣改善？" }));
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole("button", { name: "幫我生成小紅書內容" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "幫我生成小紅書內容" }));
    expect(screen.getByText("Pawly 正在整理已核實資料")).toBeVisible();

    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole("heading", { name: "小紅書草稿" })).toBeVisible();
    expect(screen.getByRole("button", { name: "一鍵發佈" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "一鍵發佈" }));
    expect(screen.getByRole("button", { name: "正在發佈" })).toBeDisabled();

    act(() => vi.advanceTimersByTime(650));
    expect(screen.getAllByText("發佈成功")).toHaveLength(3);
    expect(screen.queryByText("發佈未完成，請稍後再試。")).not.toBeInTheDocument();
    expect(screen.queryByText(/demo-lei-kei-20260809/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "看看遊客如何發現這間店" })).not.toBeInTheDocument();
  });

  it("renders the recorded receipt and completed publication state when telemetry is published", () => {
    vi.useFakeTimers();
    const legacyTelemetryShop = { ...getDemoHeritageShop("fong-kei-002"), shop_id: "sun-fong-002" };
    render(
      <DemoStateProvider initialShopId={legacyTelemetryShop.shop_id}>
        <MerchantPawly shop={legacyTelemetryShop} />
      </DemoStateProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "最近鋪頭點啊？" }));
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "市民評價" }));
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "點樣改善？" }));
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "幫我生成小紅書內容" }));
    act(() => vi.advanceTimersByTime(650));
    fireEvent.click(screen.getByRole("button", { name: "一鍵發佈" }));
    act(() => vi.advanceTimersByTime(650));

    const receipt = screen.getByText(
      (_, element) => element?.tagName === "SPAN" && element.textContent?.includes("demo-sun-fong-20260801") === true,
    );
    expect(receipt).toHaveTextContent("2026");
    expect(screen.getAllByText("發佈成功")).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "看看遊客如何發現這間店" })).not.toBeInTheDocument();
  });
});
