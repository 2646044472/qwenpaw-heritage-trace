import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { EmptyState, ErrorState, FallbackState, LoadingState } from "./async-state";

describe("async state primitives", () => {
  it("announces loading without collapsing its layout", () => {
    render(<LoadingState />);
    expect(screen.getByLabelText("Loading heritage data")).toHaveAttribute("aria-busy", "true");
  });

  it("renders an empty next action", () => {
    render(<EmptyState action={<Button>Choose a shop</Button>} description="No shop is selected." title="No data" />);
    expect(screen.getByRole("button", { name: "Choose a shop" })).toBeVisible();
  });

  it("renders an accessible retry error", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="The request timed out." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The request timed out.");
  });

  it("describes fallback state in text instead of color alone", () => {
    render(<FallbackState />);
    expect(screen.getByRole("alert")).toHaveTextContent("Demo data active");
    expect(screen.getByRole("alert")).toHaveTextContent("verified demo fallback");
  });
});
