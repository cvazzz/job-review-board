// Usage: node scripts/export_approved.mjs decisions.json [jobs.json] [-o approved_queue.json]
// Reads exported decisions plus the jobs file (default data/jobs.local.json, falling back to
// data/jobs.demo.json) and writes only the approved offers for another tool to process.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import logic from '../js/logic.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let out = 'approved_queue.json';
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o') out = args[++i];
  else pos.push(args[i]);
}
if (!pos[0]) {
  console.error('Usage: node scripts/export_approved.mjs decisions.json [jobs.json] [-o approved_queue.json]');
  process.exit(1);
}
const jobsPath = pos[1] || [join(root, 'data', 'jobs.local.json'), join(root, 'data', 'jobs.demo.json')].find(existsSync);
const decisions = logic.parseDecisions(JSON.parse(readFileSync(pos[0], 'utf8')));
if (!decisions) {
  console.error('decisions file is not valid');
  process.exit(1);
}
const jobs = logic.normalizeJobs(JSON.parse(readFileSync(jobsPath, 'utf8')));
const queue = logic.approvedQueue(jobs, decisions);
writeFileSync(out, JSON.stringify({ version: 1, approved: queue }, null, 2) + '\n');
console.log(`Wrote ${queue.length} approved offers to ${out}`);
