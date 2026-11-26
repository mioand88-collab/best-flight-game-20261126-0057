// Skyline Courier — the entry program (Node 22, standard library only).
// It hands the game in: it copies this repository's game/ and
// screenshots/ into /output and writes /output/dossier.json, the summary
// the judge reads, using the vendored make.fun library. Outside the
// grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program runs twice in grading and both runs must write the same
// bytes, so it writes nothing but the copy and the dossier, and it never
// depends on the clock, the network or anything outside this repository.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file sits in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps for this bounty (from the kit's RULES.txt):
// game/ at most 993 files and 48 MiB, index.html at most 1 MiB, and the
// dossier's text at most 160 KiB. buildDossier refuses an entry over
// them, so a bad build fails here, loudly, instead of at the gate.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(from, to) {
  if (!existsSync(from)) {
    throw new Error(`missing input directory: ${from}`);
  }
  cpSync(from, to, { recursive: true });
}

// The gate needs 3 or 4 screenshots, each a real render of the game, so
// refuse a hand-in that has none instead of letting the scorer find it.
import { readdirSync } from 'node:fs';

const shotNames = readdirSync(join(repoRoot, 'screenshots')).filter(
  (name) => !name.startsWith('.'),
);
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotNames.length}`);
}

// Start from a clean output directory so a stale file from an earlier
// run can never leak into the entry.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER_OPTIONS));
console.log(
  `Skyline Courier handed in: game/ + ${shotNames.length} screenshots -> ${outDir}/dossier.json`,
);
