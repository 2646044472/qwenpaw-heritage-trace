import type { ReactNode } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";
import { getDemoWorkflowResult } from "@/lib/heritage/demo-workflow-fixtures";

import { DemoStateProvider, useDemoState } from "./demo-state-provider";

function wrapper({ children }: { children: ReactNode }) {
  return <DemoStateProvider initialShopId="not-a-real-shop">{children}</DemoStateProvider>;
}

describe("DemoStateProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("resumes the persisted run after a page refresh without submitting again", async () => {
    const result = getDemoWorkflowResult(HERO_SHOP_ID, "禮記雪糕");
    window.localStorage.setItem("heritage-trace:government-active-run", "run-persisted001");
    const fetchImpl = vi.fn<typeof fetch>();
    const running = {
      run_id: "run-persisted001",
      shop_id: "lei-kei-001",
      case_id: "CASE-LAIKEI-001",
      route: "mine" as const,
      state: "agent_resolution" as const,
      workflow_status: "running" as const,
      agents: {
        miner: { status: "not_started" as const, session_id: null },
        archivist: { status: "not_started" as const, session_id: null },
        verifier: { status: "not_started" as const, session_id: null },
      },
      errors: [],
    };
    const finished = { ...running, state: "finished" as const, workflow_status: "finished" as const };
    fetchImpl
      .mockResolvedValueOnce(new Response(JSON.stringify(running), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(finished), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);

    const { result: hook } = renderHook(() => useDemoState(), { wrapper });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3), { timeout: 5_000 });
    await waitFor(() => expect(hook.current.state.pipeline.workflowResult).toEqual(result), { timeout: 5_000 });
    expect(hook.current.state.pipeline.runId).toBe("run-persisted001");
    expect(fetchImpl.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });
});
