import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DemoHub from "./page";

describe("DemoHub", () => {
  it("presents one quiet entry into the shared hero shop journey", () => {
    render(<DemoHub />);

    expect(screen.getByRole("heading", { name: "澳憶千尋" })).toBeInTheDocument();
    expect(screen.getByText("讓被忽略的城市文化，重新被發現、理解與看見。")).toBeInTheDocument();

    const journeyLink = screen.getByRole("link", { name: "開始旅程" });
    expect(screen.getAllByRole("link", { name: "開始旅程" })).toHaveLength(1);
    expect(journeyLink).toHaveAttribute("href", "/government");
  });
});
