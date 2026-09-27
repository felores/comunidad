import { expect, type Page, type TestInfo } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Diagnostic = {
  kind: "console" | "pageerror" | "requestfailed" | "response";
  message: string;
  url?: string;
  status?: number;
  body?: string;
};

function redact(text: string) {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[REDACTED]");
}

export function captureBrowserDiagnostics(page: Page, testInfo: TestInfo) {
  const entries: Diagnostic[] = [];
  const pending: Promise<void>[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") entries.push({ kind: "console", message: redact(message.text()), url: message.location().url });
  });
  page.on("pageerror", (error) => entries.push({ kind: "pageerror", message: redact(error.stack ?? error.message) }));
  page.on("requestfailed", (request) => entries.push({ kind: "requestfailed", message: redact(request.failure()?.errorText ?? "request failed"), url: request.url() }));
  page.on("response", (response) => {
    if (response.status() < 500) return;
    const entry: Diagnostic = { kind: "response", message: response.statusText(), status: response.status(), url: response.url() };
    entries.push(entry);
    pending.push(response.text().then((body) => { entry.body = redact(body).slice(0, 4096); }).catch(() => undefined));
  });

  return async () => {
    await Promise.all(pending);
    const file = join(process.cwd(), "test-results", "browser-diagnostics.json");
    mkdirSync(dirname(file), { recursive: true });
    const existing = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8")) as { tests?: unknown[]; failures?: Diagnostic[] }
      : { tests: [], failures: [] };
    const report = {
      tests: [...(existing.tests ?? []), { test: testInfo.title, entries, failures: entries }],
      failures: [...(existing.failures ?? []), ...entries],
    };
    const body = JSON.stringify(report, null, 2);
    writeFileSync(file, body);
    await testInfo.attach("browser-diagnostics", { body, contentType: "application/json" });
    expect(entries, "browser console and network diagnostics").toEqual([]);
  };
}
