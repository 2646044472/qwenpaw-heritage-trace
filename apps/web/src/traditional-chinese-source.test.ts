import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(process.cwd(), "src");

// These are characters whose common Traditional Chinese forms are unambiguous
// in the product copy. Keep the guard narrow so valid shared characters such as
// 「查」、「里」and「面」do not create false positives.
const simplifiedOnlyCharacters = /[个们这还为从过着发后将会对开关国实应与见说证资产总项处无暂创铺复执请间别点时数结审观联动长广当现两万业东车队号让边专协达进选区网视头气样归听写办旧线仅经并门种报页组条]/u;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    if (!/\.(ts|tsx|json)$/u.test(entry.name)) return [];
    if (entry.name.includes("macau-map-geometry") || entry.name.includes("generated")) return [];
    if (/\.test\.(ts|tsx)$/u.test(entry.name)) return [];
    return [entryPath];
  });
}

describe("Traditional Chinese source guard", () => {
  it("keeps production UI and demo data in Traditional Chinese", () => {
    const violations = sourceFiles(sourceRoot).flatMap((filePath) => {
      const lines = readFileSync(filePath, "utf8").split(/\r?\n/u);
      return lines.flatMap((line, index) =>
        simplifiedOnlyCharacters.test(line)
          ? [`${path.relative(process.cwd(), filePath)}:${index + 1}: ${line.trim()}`]
          : [],
      );
    });

    expect(violations).toEqual([]);
  });
});
