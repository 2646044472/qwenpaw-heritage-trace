import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HunterShopProjection } from "@/lib/heritage/hunter-data";
import { getHunterShops } from "@/lib/heritage/hunter-data";

import { HunterMobileSurface } from "./hunter-mobile-surface";

vi.mock("./hunter-map", () => ({
  HunterMap: ({ shops, onSelect }: { shops: HunterShopProjection[]; onSelect: (shopId: string) => void }) => (
    <div>
      {shops.map((shop) => (
        <button key={shop.shopId} onClick={() => onSelect(shop.shopId)} type="button">
          選擇 {shop.shopId}
        </button>
      ))}
    </div>
  ),
}));

describe("HunterMobileSurface discovery notification", () => {
  const shops = getHunterShops();

  it("shows the selected shop discovery notification on load", () => {
    const selected = shops.find((shop) => shop.shopId === "lei-kei-001");
    if (!selected) throw new Error("Expected the hero shop fixture");

    render(<HunterMobileSurface initialShopId={selected.shopId} shops={shops} />);

    expect(screen.getByRole("region", { name: `發現附近文化店舖：${selected.name}` })).toBeVisible();
    expect(screen.getByRole("button", { name: "加入行程" })).toBeVisible();
  });

  it("updates the notification immediately when another shop is selected", async () => {
    const selected = shops.find((shop) => shop.shopId === "lei-kei-001");
    const nextShop = shops.find((shop) => shop.shopId === "fong-kei-002");
    if (!selected || !nextShop) throw new Error("Expected Hunter shop fixtures");

    render(<HunterMobileSurface initialShopId={selected.shopId} shops={shops} />);
    fireEvent.click(screen.getByRole("button", { name: `選擇 ${nextShop.shopId}` }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: `發現附近文化店舖：${nextShop.name}` })).toBeVisible();
    });
  });

  it("allows the selected shop to be removed after adding it to the route", async () => {
    const selected = shops.find((shop) => shop.shopId === "lei-kei-001");
    if (!selected) throw new Error("Expected the hero shop fixture");

    render(<HunterMobileSurface initialShopId={selected.shopId} shops={shops} />);
    fireEvent.click(screen.getByRole("button", { name: "加入行程" }));

    await waitFor(() => {
      expect(screen.getByText("已加進今天的行程")).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: /查看行程/ }));
    fireEvent.click(screen.getByRole("button", { name: "移除目前地點" }));

    expect(screen.getByRole("button", { name: "加入行程" })).toBeVisible();
    expect(screen.queryByText("已加進今天的行程")).not.toBeInTheDocument();
  });
});
