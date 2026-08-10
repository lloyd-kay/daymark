import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { expect, test } from "vitest";

const appDirectory = resolve(process.cwd(), "app");
const sourceFilePattern = /\.(?:js|jsx|ts|tsx)$/;

test("app navigation uses native anchors instead of next/link", async () => {
  const sourceFiles = await readSourceFiles(appDirectory);
  const violations = sourceFiles.flatMap(({ filePath, source }) => {
    const projectPath = relative(process.cwd(), filePath).replaceAll("\\", "/");
    const findings: string[] = [];

    if (/(?:\bfrom\s+|\bimport\s*(?:\(\s*)?)["']next\/link["']/.test(source)) {
      findings.push(`${projectPath}: imports next/link`);
    }

    if (/<\/?Link(?:\s|>)/.test(source)) {
      findings.push(`${projectPath}: renders a Link component`);
    }

    return findings;
  });

  expect(violations).toEqual([]);
});

async function readSourceFiles(directory: string): Promise<Array<{ filePath: string; source: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filePath = resolve(directory, entry.name);

    if (entry.isDirectory()) return readSourceFiles(filePath);
    if (!entry.isFile() || !sourceFilePattern.test(entry.name)) return [];

    return [{ filePath, source: await readFile(filePath, "utf8") }];
  }));

  return files.flat();
}
