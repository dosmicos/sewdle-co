import { execSync, spawnSync } from "node:child_process";

const ESLINT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function run(command) {
  return execSync(command, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasLintableExtension(file) {
  for (const ext of ESLINT_EXTENSIONS) {
    if (file.endsWith(ext)) return true;
  }
  return false;
}

const changed = run("git diff --name-only --diff-filter=ACMRTUXB HEAD");
const untracked = run("git ls-files --others --exclude-standard");

const files = [...new Set([...changed, ...untracked])].filter(hasLintableExtension);

if (files.length === 0) {
  console.log("No hay archivos JS/TS cambiados para lint.");
  process.exit(0);
}

console.log(`Ejecutando eslint sobre ${files.length} archivo(s) cambiado(s)...`);

const result = spawnSync("eslint", files, { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
