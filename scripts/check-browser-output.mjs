import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["dist/client", "dist/pages"];
const forbidden = [
  "CONTROL_PLANE_TOKEN",
  "RESEND_API_KEY",
  "REMARK42_SECRET",
  "server-only-token-sentinel",
  "aos.markenetica.com",
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".mjs", ".txt", ".xml"]);
const findings = [];

async function scan(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    if (!entry.isFile() || !textExtensions.has(extname(entry.name))) continue;
    const content = await readFile(path, "utf8");
    for (const marker of forbidden) {
      if (content.includes(marker)) findings.push(`${path}: ${marker}`);
    }
  }
}

for (const root of roots) await scan(root);
if (findings.length) {
  console.error("Server-only marker found in browser output:\n" + findings.join("\n"));
  process.exit(1);
}
console.log("Browser output contains no server-only configuration markers.");
