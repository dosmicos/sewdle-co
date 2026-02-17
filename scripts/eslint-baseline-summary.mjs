import fs from "node:fs";

const BASELINE_PATH = ".eslint-baseline.json";

if (!fs.existsSync(BASELINE_PATH)) {
  console.error(`No se encontró ${BASELINE_PATH}`);
  process.exit(1);
}

const raw = fs.readFileSync(BASELINE_PATH, "utf8");
const report = JSON.parse(raw);

let errors = 0;
let warnings = 0;
const byRule = new Map();
const byFile = [];

for (const file of report) {
  if (!file.messages?.length) continue;

  let fileErrors = 0;
  let fileWarnings = 0;
  for (const msg of file.messages) {
    if (msg.severity === 2) {
      errors += 1;
      fileErrors += 1;
    } else if (msg.severity === 1) {
      warnings += 1;
      fileWarnings += 1;
    }

    const rule = msg.ruleId || "unknown";
    byRule.set(rule, (byRule.get(rule) || 0) + 1);
  }

  byFile.push({
    filePath: file.filePath,
    total: fileErrors + fileWarnings,
    errors: fileErrors,
    warnings: fileWarnings,
  });
}

const topRules = [...byRule.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

const topFiles = byFile
  .sort((a, b) => b.total - a.total)
  .slice(0, 15);

console.log("=== ESLint Baseline ===");
console.log(`Errores: ${errors}`);
console.log(`Warnings: ${warnings}`);
console.log(`Total: ${errors + warnings}`);

console.log("\nTop reglas:");
for (const [rule, count] of topRules) {
  console.log(`- ${rule}: ${count}`);
}

console.log("\nTop archivos:");
for (const file of topFiles) {
  console.log(`- ${file.filePath} (total ${file.total}, errores ${file.errors}, warnings ${file.warnings})`);
}
