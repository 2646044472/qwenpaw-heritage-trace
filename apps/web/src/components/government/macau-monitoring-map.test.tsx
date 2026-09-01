import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getDemoHeritageShop, getDemoShopSeed, HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";
import { normalizeShopPosition } from "@/lib/heritage/government-data";

import { calculateMapFocus, MacauMonitoringMap } from "./macau-monitoring-map";

const SECOND_SHOP_ID = "fong-kei-002";

function marker(id: string) {
  const seed = getDemoShopSeed(id);
  return { seed, shop: getDemoHeritageShop(id), position: normalizeShopPosition(seed) };
}

function renderMap(onSelect = vi.fn()) {
  render(
    <MacauMonitoringMap
      markers={[marker(HERO_SHOP_ID), marker(SECOND_SHOP_ID)]}
      onHover={vi.fn()}
      onSelect={onSelect}
      selectedShopId={HERO_SHOP_ID}
      hoveredShopId={null}
    />,
  );
}

describe("MacauMonitoringMap", () => {
  it("renders the DSEC map and accessible merchant controls", () => {
    renderMap();
    expect(screen.getByRole("img", { name: "澳門地理底圖及文化商戶位置" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /禮記雪糕/ })).toBeInTheDocument();
    expect(screen.getByText("拖動地圖探索 · 滾輪縮放")).toBeInTheDocument();
  });

  it("selects a merchant through its accessible marker control", () => {
    const onSelect = vi.fn();
    renderMap(onSelect);
    fireEvent.click(screen.getByRole("link", { name: /晃記餅家/ }));
    expect(onSelect).toHaveBeenCalledWith(SECOND_SHOP_ID);
  });

  it("zooms and resets with the map controls", () => {
    renderMap();
    const map = screen.getByRole("img", { name: "澳門地理底圖及文化商戶位置" });
    expect(map).toHaveStyle({ transform: "translate(0px,0px) scale(1.6)" });
    fireEvent.click(screen.getByRole("button", { name: "放大地圖" }));
    expect(map).toHaveStyle({ transform: "translate(0px,0px) scale(1.8)" });
    fireEvent.click(screen.getByRole("button", { name: "顯示全澳" }));
    expect(map).toHaveStyle({ transform: "translate(0px,0px) scale(1.08)" });
  });

  it("focuses a selected marker in the visible map area beside the panel", () => {
    const focused = calculateMapFocus({ x: 500, y: 500 }, 1200, 800, true);
    const overview = calculateMapFocus({ x: 500, y: 500 }, 1200, 800, false);
    expect(focused.scale).toBe(1.6);
    expect(focused.x).toBeLessThan(overview.x);
  });
});
