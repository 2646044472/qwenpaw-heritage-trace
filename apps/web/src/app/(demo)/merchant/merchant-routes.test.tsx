import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DemoStateProvider } from "@/components/demo/demo-state-provider";

import MerchantDataPage from "./data/page";
import MerchantPage from "./page";

const leiKeiSearchParams = Promise.resolve({ shop: "lei-kei-001" });

describe("Merchant routes", () => {
  it("keeps the selected shop when moving from Pawly to the data console", async () => {
    render(
      <DemoStateProvider initialShopId="lei-kei-001">
        {await MerchantPage({ searchParams: leiKeiSearchParams })}
      </DemoStateProvider>,
    );

    expect(screen.getByRole("link", { name: "數據後臺" })).toHaveAttribute("href", "/merchant/data?shop=lei-kei-001");
  });

  it("keeps the selected shop when moving from the data console to Pawly", async () => {
    render(
      <DemoStateProvider initialShopId="lei-kei-001">
        {await MerchantDataPage({ searchParams: leiKeiSearchParams })}
      </DemoStateProvider>,
    );

    expect(screen.getByRole("link", { name: "Pawly 助手" })).toHaveAttribute("href", "/merchant?shop=lei-kei-001");
  });
});
