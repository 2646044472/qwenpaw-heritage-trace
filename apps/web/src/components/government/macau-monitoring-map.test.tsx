import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => vi.restoreAllMocks());
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
    expect(map).toHaveStyle({ transform: "translate(0px,0px) scale(1.7000000000000002)" });
    fireEvent.click(screen.getByRole("button", { name: "顯示全澳" }));
    expect(map).toHaveStyle({ transform: "translate(0px,0px) scale(1.08)" });
  });

  it("preserves every wheel delta while committing only one update per frame", () => {
    const frames: FrameRequestCallback[] = [];
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    renderMap();
    const map = screen.getByRole("img", { name: "澳門地理底圖及文化商戶位置" });
    for (let i = 0; i < 3; i++) fireEvent.wheel(map, { deltaY: -100 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(map).toHaveStyle({ transition: "none" });
    expect(map.parentElement).toHaveStyle({ transform: "translate(0px,0px) scale(1.6)" });
    act(() => frames[0](16));
    const scale = Number(map.parentElement?.style.transform.match(/scale\(([^)]+)\)/)?.[1]);
    expect(scale).toBeCloseTo(2.05);
  });

  it("cancels a queued gesture when resetting or unmounting the map", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++id, callback);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
      frames.delete(frame);
    });
    const rendered = render(
      <MacauMonitoringMap
        markers={[marker(HERO_SHOP_ID)]}
        selectedShopId={HERO_SHOP_ID}
        hoveredShopId={null}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    const map = screen.getByRole("img", { name: "澳門地理底圖及文化商戶位置" });
    fireEvent.wheel(map, { deltaY: -100 });
    fireEvent.click(screen.getByRole("button", { name: "顯示全澳" }));
    expect(frames.size).toBe(0);
    expect(map.parentElement).toHaveStyle({ transform: "translate(0px,0px) scale(1.08)" });
    fireEvent.wheel(map, { deltaY: -100 });
    expect(frames.size).toBe(1);
    rendered.unmount();
    expect(frames.size).toBe(0);
  });

  it("focuses a selected marker in the visible map area beside the panel", () => {
    const focused = calculateMapFocus({ x: 500, y: 500 }, 1200, 800, true);
    const overview = calculateMapFocus({ x: 500, y: 500 }, 1200, 800, false);
    expect(focused.scale).toBe(1.6);
    expect(focused.x).toBeLessThan(overview.x);
  });
});
