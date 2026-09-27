import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));

export function auditPlatformGates(platformGates, sinapsoFeatures) {
  const features = new Map(
    (sinapsoFeatures?.features ?? []).map((feature) => [feature.id, feature]),
  );
  const results = [];

  for (const [platform, gate] of Object.entries(platformGates)) {
    const feature = features.get(gate.featureId);
    if (!feature) {
      throw new Error(`${platform}: missing Sinapso feature ${gate.featureId}`);
    }

    if (gate.status === "approved") {
      if (feature.state !== "passing" || !feature.verified_at) {
        throw new Error(
          `${platform}: ${gate.featureId} is ${feature.state} without approved verification`,
        );
      }
      if (!gate.approvedAt || !gate.artifactVersion || !gate.evidence) {
        throw new Error(`${platform}: approved gate is missing delivery evidence`);
      }
    }

    results.push({
      platform,
      localStatus: gate.status,
      featureId: gate.featureId,
      sinapsoState: feature.state,
      deliverable: gate.status === "approved",
    });
  }

  return results;
}

async function run() {
  const gatesPath = resolve(currentDirectory, "platform-gates.json");
  const featuresPath = resolve(
    process.env.SINAPSO_FEATURES_PATH ?? "../sinapso/.harness/features.json",
  );
  const [platformGates, sinapsoFeatures] = await Promise.all([
    readFile(gatesPath, "utf8").then(JSON.parse),
    readFile(featuresPath, "utf8").then(JSON.parse),
  ]);

  for (const result of auditPlatformGates(platformGates, sinapsoFeatures)) {
    console.log(
      `${result.platform}: ${result.featureId}=${result.sinapsoState}; local=${result.localStatus}; deliverable=${result.deliverable}`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
