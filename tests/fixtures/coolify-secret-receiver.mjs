import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";

const expectedToken = process.env.EXPECTED_COOLIFY_TOKEN;
const responseStatus = Number(process.env.RESPONSE_STATUS);
if (!expectedToken || ![201, 500].includes(responseStatus)) throw new Error("Invalid receiver configuration");

const server = createServer({
  key: readFileSync("/tls/server.key"),
  cert: readFileSync("/tls/server.crt"),
}, async (request, response) => {
  try {
    if (request.method !== "PATCH" || request.url !== "/api/v1/services/service-test/envs") {
      throw new Error("Unexpected Coolify request target");
    }
    if (request.headers.authorization !== `Bearer ${expectedToken}`) {
      throw new Error("Unexpected Coolify authorization");
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16_384) throw new Error("Coolify request body is too large");
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      body.key !== "AUTH_CUSTOM_CSEC" ||
      typeof body.value !== "string" ||
      !body.value ||
      body.is_preview !== false ||
      body.is_literal !== true ||
      body.is_multiline !== false ||
      body.is_shown_once !== true
    ) {
      throw new Error("Unexpected Coolify request body");
    }
    body.value = undefined;
    for (const chunk of chunks) chunk.fill(0);
    writeFileSync("/evidence/result.json", `${JSON.stringify({ accepted: true, responseStatus })}\n`, { mode: 0o644 });
    response.statusCode = responseStatus;
    response.end();
  } catch {
    response.statusCode = 400;
    response.end();
  }
});

server.listen(8443, "0.0.0.0", () => console.log("coolify-receiver-ready"));
