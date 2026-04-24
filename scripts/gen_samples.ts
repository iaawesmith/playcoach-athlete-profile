import fs from "node:fs";
import { generateTabMarkdown, generateFullNodeMarkdown } from "../src/features/athlete-lab/utils/nodeExport";
import type { TrainingNode } from "../src/features/athlete-lab/types";

const raw = fs.readFileSync("/tmp/slant_node.json", "utf8").trim();
const node = JSON.parse(raw) as TrainingNode;

// Force one metric inactive for the sample so admin can see split rendering.
if (node.key_metrics && node.key_metrics.length > 1) {
  node.key_metrics = node.key_metrics.map((m, i) =>
    i === node.key_metrics.length - 1 ? { ...m, active: false } : m
  );
}

const metricsOut = generateTabMarkdown(node, "metrics");
const basicsOut = generateTabMarkdown(node, "basics");
const trainingOut = generateTabMarkdown(node, "training_status");
const fullOut = generateFullNodeMarkdown(node);

fs.writeFileSync("/tmp/sample_metrics.md", metricsOut);
fs.writeFileSync("/tmp/sample_basics.md", basicsOut);
fs.writeFileSync("/tmp/sample_training.md", trainingOut);
fs.writeFileSync("/tmp/sample_full.md", fullOut);

console.log("Wrote /tmp/sample_metrics.md", metricsOut.length, "chars");
console.log("Wrote /tmp/sample_basics.md", basicsOut.length, "chars");
console.log("Wrote /tmp/sample_training.md", trainingOut.length, "chars");
console.log("Wrote /tmp/sample_full.md", fullOut.length, "chars");
