import type { ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";

import { DemoStateProvider, useDemoState } from "./demo-state-provider";

function wrapper({ children }: { children: ReactNode }) {
  return <DemoStateProvider initialShopId="not-a-real-shop">{children}</DemoStateProvider>;
}

describe("DemoStateProvider", () => {
  it("falls back to the hero shop for an invalid initial id", () => {
    const { result } = renderHook(() => useDemoState(), { wrapper });
    expect(result.current.state.selectedShopId).toBe(HERO_SHOP_ID);
  });

  it("selects a known shop and resets the whole lifecycle", () => {
    const { result } = renderHook(() => useDemoState(), { wrapper });
    act(() => result.current.selectShop("fong-kei-002"));
    expect(result.current.state.selectedShopId).toBe("fong-kei-002");

    act(() => result.current.resetDemo());
    expect(result.current.state).toEqual({
      selectedShopId: HERO_SHOP_ID,
      government: { notificationUnread: true, selectedShopId: HERO_SHOP_ID },
      merchant: { messages: [], generatedDraft: null, simulatedPublished: false },
      hunter: { route: "before", recommendationOpen: false },
      pipeline: {
        runId: null,
        workflowStatus: "idle",
        workflowSource: "idle",
        workflowResult: null,
        workflowError: null,
        isRunning: false,
      },
    });
  });
});
