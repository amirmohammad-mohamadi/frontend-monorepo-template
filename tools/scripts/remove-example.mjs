/**
 * Deletes the `example` reference domain once a real domain exists:
 * its DTO, model, services folder, the pages in both apps, the mock routes
 * stay (harmless) and the barrel exports and endpoint entry are stripped.
 *
 *   npm run example:remove
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const rm = (p) => {
  const full = resolve(root, p);
  if (existsSync(full)) {
    rmSync(full, { recursive: true, force: true });
    console.log("removed", p);
  }
};
const stripLines = (p, test) => {
  const full = resolve(root, p);
  if (!existsSync(full)) return;
  const before = readFileSync(full, "utf8");
  const after = before
    .split(/\r?\n/)
    .filter((line) => !test(line))
    .join("\n");
  if (after !== before) {
    writeFileSync(full, after);
    console.log("edited ", p);
  }
};

for (const p of [
  "libs/dtos/src/lib/example",
  "libs/models/src/lib/example",
  "libs/services/src/lib/example",
  "apps/web/src/app/[locale]/examples",
  "apps/web/src/features/examples",
  "apps/admin/src/app/(dashboard)/examples",
  "apps/admin/src/features/examples",
]) {
  rm(p);
}

stripLines("libs/dtos/src/index.ts", (l) => l.includes("/example"));
stripLines("libs/models/src/index.ts", (l) => l.includes("/example"));
stripLines("libs/services/src/index.ts", (l) => l.includes("/example"));

// The endpoints entry spans several lines: drop the `example: { ... },` block.
const endpointsPath = resolve(root, "libs/services/src/lib/shared/endpoints.ts");
const endpoints = readFileSync(endpointsPath, "utf8").replace(/\n {2}example: \{[\s\S]*?\n {2}\},/, "");
writeFileSync(endpointsPath, endpoints);
console.log("edited  libs/services/src/lib/shared/endpoints.ts");

console.log(`
Done. Still to do by hand:
  - apps/admin/src/config/navigation.ts: remove the Examples entry
  - apps/admin/src/features/overview/overview.tsx: remove the examples card
  - apps/web/src/components/site-header.tsx and app/[locale]/page.tsx: remove the Examples links
  - apps/web/messages/*.json: remove the "examples" namespace
  - apps/admin/src/texts.ts: remove the "examples" section
Then run: npm run check`);
