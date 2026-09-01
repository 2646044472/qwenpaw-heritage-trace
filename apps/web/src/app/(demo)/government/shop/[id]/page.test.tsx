import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";

import GovernmentEvidencePage from "./page";

describe("Government evidence detail", () => {
  it("renders the safe verified projection for the selected shop", async () => {
    const page = await GovernmentEvidencePage({ params: Promise.resolve({ id: HERO_SHOP_ID }) });
    render(page);
    expect(screen.getByRole("heading", { name: "文化資料核實檔案" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "核實摘要" })).toBeInTheDocument();
    expect(screen.getAllByText("可發布").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /政府監察中心/ })).toHaveAttribute(
      "href",
      `/government?shop=${HERO_SHOP_ID}`,
    );
    const rendered = document.body.textContent ?? "";
    expect(rendered).not.toContain(["Archivist", "Output"].join(""));
    expect(rendered).not.toContain(["Verifier", "Output"].join(""));
    expect(rendered).not.toContain(["story", "claims"].join("_"));
    expect(rendered).not.toContain(["claim", "verifications"].join("_"));
  });

  it("falls back to the hero evidence for an invalid route id", async () => {
    const page = await GovernmentEvidencePage({ params: Promise.resolve({ id: "missing-shop" }) });
    render(page);
    expect(screen.getByRole("link", { name: /政府監察中心/ })).toHaveAttribute(
      "href",
      `/government?shop=${HERO_SHOP_ID}`,
    );
  });
});
