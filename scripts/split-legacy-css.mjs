import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "src/styles/legacy.css"), "utf8");
const markers = [
  ["theme-light.css", "/* Modern light Alliance layer - visual only */"],
  ["theme-dark.css", "/* Dark theme restores the original dark experience when selected */"],
  ["dashboard.css", "/* Dashboard command layout: visual layer only, calculations stay unchanged */"],
  ["hardening.css", "/* Camada final de hardening visual para reduzir regressões entre tema claro e escuro. */"]
];

const positions = markers.map(([, marker]) => {
  const position = source.indexOf(marker);
  if (position < 0) throw new Error(`Marcador CSS não encontrado: ${marker}`);
  return position;
});

const files = [
  ["foundation.css", source.slice(0, positions[0])],
  ...markers.map(([name], index) => [name, source.slice(positions[index], positions[index + 1])])
];

for (const [name, contents] of files) {
  writeFileSync(resolve(root, "src/styles", name), `${contents.trim()}\n`, "utf8");
}

writeFileSync(resolve(root, "src/styles/index.css"), files.map(([name]) => `@import "./${name}";`).join("\n") + "\n", "utf8");
console.log(files.map(([name, contents]) => `${name}: ${contents.split(/\r?\n/).length} linhas`).join("\n"));
