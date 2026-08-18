import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await copyFile(join(root, "styles.css"), join(output, "styles.css"));

const sourceHtml = await readFile(join(root, "index.html"), "utf8");
const builtHtml = sourceHtml.replace(
  /<script\s+type="module"\s+src="src\/app\.js\?v=\d+"><\/script>/,
  '<script src="bundle.js"></script>'
);
if (builtHtml === sourceHtml) throw new Error("Unable to replace the module script in index.html");
await writeFile(join(output, "index.html"), builtHtml, "utf8");

const { MAP_DATA } = await import(new URL("../src/map-data.js", import.meta.url));
const projections = (await readFile(join(root, "src/projections.js"), "utf8"))
  .replace(/^export\s+/gm, "");
const app = (await readFile(join(root, "src/app.js"), "utf8"))
  .replace(/^import\s+.*?;\r?\n/gm, "");
const bundle = [
  "// Territory standalone browser bundle.",
  "(() => {",
  '"use strict";',
  `const MAP_DATA=${JSON.stringify(MAP_DATA)};`,
  projections,
  app,
  "})();",
  ""
].join("\n");
await writeFile(join(output, "bundle.js"), bundle, "utf8");

const builtFiles = ["index.html", "styles.css", "bundle.js"];
let totalBytes = 0;
for (const relativePath of builtFiles) totalBytes += (await stat(join(output, relativePath))).size;

console.log(`Built ${builtFiles.length} files in ${output}`);
console.log(`Bundle size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
