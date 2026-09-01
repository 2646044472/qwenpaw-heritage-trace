import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getDemoHeritageShop } from "@/lib/heritage/demo-seeds";

import { MerchantPawly } from "./merchant-pawly";

describe("Merchant Pawly publication flow", () => {
  afterEach(() => vi.useRealTimers());

  it("shows completion without fabricating a telemetry receipt", () => {
    vi.useFakeTimers();
    render(<MerchantPawly shop={getDemoHeritageShop("lei-kei-001")} />);

    fireEvent.click(screen.getByRole("button", { name: "最近鋪頭點啊？" }));
    act(() => vi.advanceTimersByTime(700));
    expect(within(screen.getByLabelText("老闆 訊息")).getByText("最近鋪頭點啊？")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "市民評價" }));
    expect(screen.getByText("正在調用小紅書工具，整理市民評價")).toBeVisible();
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "點樣改善？" }));
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole("button", { name: "幫我生成小紅書內容" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "幫我生成小紅書內容" }));
    expect(screen.getByText("Pawly 正在整理已核實資料")).toBeVisible();

    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole("heading", { name: "小紅書草稿" })).toBeVisible();
    expect(screen.getByRole("button", { name: "確認並發佈" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "確認並發佈" }));
    expect(screen.getByRole("button", { name: "正在發佈到小紅書" })).toBeDisabled();

    act(() => vi.advanceTimersByTime(650));
    expect(screen.getAllByText("發佈已完成")).toHaveLength(2);
    expect(screen.queryByText("發佈未完成，請稍後再試。")).not.toBeInTheDocument();
    expect(screen.queryByText(/xhs-lei-kei-20260809/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "看看遊客如何發現這間店" })).not.toBeInTheDocument();
  });

  it("renders the recorded receipt and completed publication state when telemetry is published", () => {
    vi.useFakeTimers();
    const legacyTelemetryShop = { ...getDemoHeritageShop("fong-kei-002"), shop_id: "sun-fong-002" };
    render(<MerchantPawly shop={legacyTelemetryShop} />);

    fireEvent.click(screen.getByRole("button", { name: "最近鋪頭點啊？" }));
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "市民評價" }));
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "點樣改善？" }));
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "生成小紅書內容" }));
    act(() => vi.advanceTimersByTime(650));
    fireEvent.click(screen.getByRole("button", { name: "確認並發佈" }));
    act(() => vi.advanceTimersByTime(650));

    const receipt = screen.getByText(
      (_, element) => element?.tagName === "SPAN" && element.textContent?.includes("xhs-sun-fong-20260801") === true,
    );
    expect(receipt).toHaveTextContent("2026");
    expect(screen.getAllByText("發佈已完成")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "看看遊客如何發現這間店" })).not.toBeInTheDocument();
  });
});
