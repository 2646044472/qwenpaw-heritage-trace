import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";
import { getDemoWorkflowResult } from "@/lib/heritage/demo-workflow-fixtures";

import { DemoStateProvider } from "../demo/demo-state-provider";
import { GovernmentCommandCenter } from "./government-command-center";

const navigation = vi.hoisted(() => ({ query: "shop=lei-kei-001", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/government",
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

function renderCommandCenter(initialShopId = HERO_SHOP_ID) {
  return render(
    <DemoStateProvider initialShopId={initialShopId}>
      <GovernmentCommandCenter />
    </DemoStateProvider>,
  );
}

describe("GovernmentCommandCenter", () => {
  beforeEach(() => {
    navigation.query = `shop=${HERO_SHOP_ID}`;
    navigation.replace.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the selected enriched shop from the query", () => {
    renderCommandCenter();
    expect(screen.getByRole("complementary", { name: "選中商戶分析" })).toBeInTheDocument();
    expect(screen.getAllByText(HERO_SHOP_ID).length).toBeGreaterThan(0);
  });

  it("shows the map without a detail panel when no shop is selected", () => {
    navigation.query = "";
    renderCommandCenter();
    expect(screen.queryByRole("complementary", { name: "選中商戶分析" })).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("closes the panel and removes the shop query", () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "關閉商戶詳情" }));
    expect(navigation.replace).toHaveBeenCalledWith("/government", { scroll: false });
  });

  it("selects an enriched shop from the intelligence rail", () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: /晃記餅家/, pressed: false }));
    expect(navigation.replace).toHaveBeenCalledWith("/government?shop=fong-kei-002", { scroll: false });
  });

  it("selects an enriched shop from its visible map marker", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("link", { name: /最香餅家/ }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/government?shop=chui-heong-003", { scroll: false }),
    );
  });

  it("shows the shared demo signals for the hero shop", () => {
    renderCommandCenter();
    expect(screen.getByText("76")).toBeInTheDocument();
    expect(screen.getAllByText(HERO_SHOP_ID).length).toBeGreaterThan(0);
  });

  it("provides evidence navigation for the selected shop", () => {
    renderCommandCenter();
    expect(screen.getByRole("link", { name: /分析依據/ })).toHaveAttribute("href", `/government/shop/${HERO_SHOP_ID}`);
  });

  it("projects a successful live result into the Government dossier", async () => {
    const result = getDemoWorkflowResult(HERO_SHOP_ID, "禮記雪糕");
    const fetchImpl = vi.fn<typeof fetch>();
    const status = {
      run_id: "run-87b1de429bdd0e5f",
      case_id: "CASE-LAIKEI-001",
      route: "mine" as const,
      state: "finished" as const,
      workflow_status: "finished" as const,
      agents: {
        miner: { status: "completed", session_id: null },
        archivist: { status: "completed", session_id: null },
        verifier: { status: "completed", session_id: null },
      },
      errors: [],
    };
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify(status), { status: 202, headers: { "content-type": "application/json" } }),
    );
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Run live workflow" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "禮記雪糕" })).toBeInTheDocument());
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
