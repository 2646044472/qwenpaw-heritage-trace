import { describe, expect, it } from "vitest";

import { isMatchingPointer } from "./hunter-map-state";

describe("hunter map drag state", () => {
  it("ignores a pointer move while a Fast Refresh-preserved drag ref is null", () => {
    expect(isMatchingPointer(null, 12)).toBe(false);
  });

  it("accepts only the pointer that started the drag", () => {
    expect(isMatchingPointer({ pointerId: 12, x: 100, y: 120 }, 12)).toBe(true);
    expect(isMatchingPointer({ pointerId: 12, x: 100, y: 120 }, 13)).toBe(false);
  });
});
