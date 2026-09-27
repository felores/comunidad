import { chmod, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const outputDirectory = "dist-ops";
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: ["scripts/provision-remark42-oauth-client.mjs"],
  outfile: `${outputDirectory}/provision-remark42-oauth-client.mjs`,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  target: "node22",
});

await build({
  entryPoints: ["scripts/sp-load-coolify-secret"],
  outfile: `${outputDirectory}/sp-load-coolify-secret`,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  target: "node22",
});
await chmod(`${outputDirectory}/sp-load-coolify-secret`, 0o555);
await build({
  entryPoints: ["scripts/start-coolify-secret-loader.mjs"],
  outfile: `${outputDirectory}/start-coolify-secret-loader`,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  target: "node22",
});
await chmod(`${outputDirectory}/start-coolify-secret-loader`, 0o555);
