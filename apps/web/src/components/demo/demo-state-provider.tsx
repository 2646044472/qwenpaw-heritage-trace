"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import {
  runHeritageWorkflowWithFallback,
  type WorkflowAdapterErrorCode,
  type WorkflowSource,
} from "@/lib/heritage/api-client";
import type { MiningRequest, WorkflowResult, WorkflowStatus } from "@/lib/heritage/application-types";
import { getDemoShopSeed, HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";

export const LIVE_HERO_WORKFLOW_REQUEST: MiningRequest = {
  shop_id: HERO_SHOP_ID,
  case_id: "CASE-LAIKEI-001",
  shop_name: "禮記雪糕",
  aliases: ["Lai Kei Ice Cream"],
  location_hint: "Macao",
};

type WorkflowUiStatus =
  | "idle"
  | "submitting"
  | "timeout"
  | "abort"
  | "transport_failure"
  | WorkflowStatus["state"];
type WorkflowErrorCode = WorkflowAdapterErrorCode | "workflow_failed";
type WorkflowError = { code: WorkflowErrorCode; message: string };
type WorkflowSourceState = "idle" | WorkflowSource;

export type DemoState = {
  selectedShopId: string;
  government: { notificationUnread: boolean; selectedShopId: string };
  merchant: { messages: string[]; generatedDraft: string | null; simulatedPublished: boolean };
  hunter: { route: "before" | "after"; recommendationOpen: boolean };
  pipeline: {
    runId: string | null;
    workflowStatus: WorkflowUiStatus;
    workflowSource: WorkflowSourceState;
    workflowResult: WorkflowResult | null;
    workflowError: WorkflowError | null;
    isRunning: boolean;
  };
};

type DemoStateContextValue = {
  state: DemoState;
  selectShop: (shopId: string) => void;
  startWorkflow: () => Promise<void>;
  abortWorkflow: () => void;
  resetDemo: () => void;
};

const DemoStateContext = createContext<DemoStateContextValue | null>(null);

function createInitialState(shopId?: string): DemoState {
  const selectedShopId = getDemoShopSeed(shopId).shop_id;
  return {
    selectedShopId,
    government: { notificationUnread: true, selectedShopId },
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
  };
}

export function DemoStateProvider({ children, initialShopId }: { children: ReactNode; initialShopId?: string }) {
  const [state, setState] = useState<DemoState>(() => createInitialState(initialShopId));
  const workflowController = useRef<AbortController | null>(null);

  const selectShop = useCallback((shopId: string) => {
    const selectedShopId = getDemoShopSeed(shopId).shop_id;
    setState((current) => ({
      ...current,
      selectedShopId,
      government: { ...current.government, selectedShopId },
    }));
  }, []);

  const startWorkflow = useCallback(async () => {
    if (workflowController.current !== null) return;

    const controller = new AbortController();
    workflowController.current = controller;
    setState((current) => ({
      ...current,
      pipeline: {
        ...current.pipeline,
        workflowStatus: "submitting",
        workflowError: null,
        isRunning: true,
      },
    }));

    try {
      const response = await runHeritageWorkflowWithFallback(LIVE_HERO_WORKFLOW_REQUEST, {
        signal: controller.signal,
        onStatus: (status) => {
          setState((current) => ({
            ...current,
            pipeline: {
              ...current.pipeline,
              runId: status.run_id,
              workflowStatus: status.state,
              workflowError: null,
              isRunning: status.workflow_status === "running",
            },
          }));
        },
      });

      if (workflowController.current !== controller) return;

      setState((current) => {
        const wasSuccessfulLiveResult =
          current.pipeline.workflowSource === "api" && current.pipeline.workflowResult?.workflow_status === "finished";
        const shouldKeepLiveResult = wasSuccessfulLiveResult && response.source === "demo-fallback";
        let workflowError: WorkflowError | null = null;
        if (response.source === "demo-fallback") {
          workflowError = {
            code: response.fallback_code ?? "transport",
            message: response.fallback_reason ?? "Live workflow unavailable.",
          };
        } else if (response.result.workflow_status === "completed_with_errors") {
          workflowError = {
            code: "workflow_failed",
            message: response.result.errors[0]?.message ?? "Workflow failed.",
          };
        }
        let workflowStatus: WorkflowUiStatus = response.result.workflow_status;
        if (response.source === "demo-fallback") {
          workflowStatus = response.fallback_code === "timeout" ? "timeout" : "transport_failure";
        }

        return {
          ...current,
          pipeline: {
            ...current.pipeline,
            runId: response.run_id ?? current.pipeline.runId,
            workflowStatus,
            workflowSource: shouldKeepLiveResult ? current.pipeline.workflowSource : response.source,
            workflowResult: shouldKeepLiveResult ? current.pipeline.workflowResult : response.result,
            workflowError,
            isRunning: false,
          },
        };
      });
    } catch (error) {
      const adapterError = error as Partial<{ code: WorkflowAdapterErrorCode; message: string }>;
      if (workflowController.current !== controller) return;
      const code = adapterError.code;
      let workflowStatus: WorkflowUiStatus = "transport_failure";
      if (code === "timeout") workflowStatus = "timeout";
      if (code === "aborted") workflowStatus = "abort";

      setState((current) => ({
        ...current,
        pipeline: {
          ...current.pipeline,
          workflowStatus,
          workflowSource: current.pipeline.workflowResult?.workflow_status === "finished" ? "api" : "idle",
          workflowError: {
            code: code ?? "transport",
            message: adapterError.message ?? "Workflow request failed.",
          },
          isRunning: false,
        },
      }));
    } finally {
      workflowController.current = null;
    }
  }, []);

  const abortWorkflow = useCallback(() => {
    workflowController.current?.abort(new DOMException("Workflow request aborted.", "AbortError"));
  }, []);

  const resetDemo = useCallback(() => {
    workflowController.current?.abort(new DOMException("Workflow reset.", "AbortError"));
    workflowController.current = null;
    setState(createInitialState(HERO_SHOP_ID));
  }, []);
  const value = useMemo(
    () => ({ state, selectShop, startWorkflow, abortWorkflow, resetDemo }),
    [abortWorkflow, resetDemo, selectShop, startWorkflow, state],
  );

  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState(): DemoStateContextValue {
  const value = useContext(DemoStateContext);
  if (!value) {
    throw new Error("useDemoState must be used within DemoStateProvider");
  }
  return value;
}
