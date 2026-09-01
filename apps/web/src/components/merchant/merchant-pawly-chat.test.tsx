import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getDemoHeritageShop } from "@/lib/heritage/demo-seeds";

import { MerchantPawly } from "./merchant-pawly";

describe("Merchant Pawly transcript", () => {
  afterEach(() => vi.useRealTimers());

  it("adds suggested and free-text owner turns to the same conversation", () => {
    vi.useFakeTimers();
    render(<MerchantPawly shop={getDemoHeritageShop("lei-kei-001")} />);

    fireEvent.click(screen.getByRole("button", { name: "最近鋪頭點啊？" }));
    act(() => vi.advanceTimersByTime(700));

    expect(screen.getByLabelText("老闆 訊息")).toHaveTextContent("最近鋪頭點啊？");
    expect(screen.getByText("店舖曝光數據，以及市民對店舖的評價。你想先睇客人點講，定係睇曝光？")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "店舖曝光數據" }));
    act(() => vi.advanceTimersByTime(700));

    fireEvent.change(screen.getByPlaceholderText("想問 Pawly？"), { target: { value: "想知道更多" } });
    fireEvent.click(screen.getByRole("button", { name: "發送訊息" }));

    expect(within(screen.getAllByLabelText("老闆 訊息")[2]).getByText("想知道更多")).toBeVisible();
    expect(screen.getByText("Pawly 正在整理已核實資料")).toBeVisible();

    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByText(/收到，我會以目前已核實文化資料/)).toBeVisible();
  });
});
