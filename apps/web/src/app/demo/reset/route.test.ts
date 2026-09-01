import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /demo/reset", () => {
  it("returns to the hub with the canonical hero shop", () => {
    const response = GET(new Request("https://heritage.test/demo/reset"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://heritage.test/?shop=lei-kei-001");
  });
});
