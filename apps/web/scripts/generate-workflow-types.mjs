import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const contractCandidates = [
  process.env.HERITAGE_WORKFLOW_CONTRACT,
  path.resolve(projectRoot, "../../packages/contracts/heritage-workflow.openapi.yaml"),
].filter(Boolean);
const contractPath = contractCandidates.find((candidate) => existsSync(candidate));
const outputPath = path.resolve(projectRoot, "src/lib/heritage/generated/workflow-types.ts");
const checkOnly = process.argv.includes("--check");

if (!contractPath) {
  throw new Error(`Backend-owned Workflow contract not found. Checked:\n${contractCandidates.join("\n")}`);
}

const generated = `${COMMENT_HEADER}${astToString(await openapiTS(pathToFileURL(contractPath)), { fileName: outputPath })}`;

if (checkOnly) {
  const existing = await readFile(outputPath, "utf8").catch(() => null);
  if (existing !== generated) {
    console.error(`Generated Workflow types are out of date: ${path.relative(projectRoot, outputPath)}`);
    process.exitCode = 1;
  }
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, "utf8");
  console.log(`Generated ${path.relative(projectRoot, outputPath)} from ${path.relative(projectRoot, contractPath)}`);
}
