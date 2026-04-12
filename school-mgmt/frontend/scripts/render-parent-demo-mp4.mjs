import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { renderNarratedVideo } from './lib/render-narrated-demo.mjs';

const runDateArgIndex = process.argv.findIndex((value) => value === '--run-date');
const runDate =
  (runDateArgIndex >= 0 ? process.argv[runDateArgIndex + 1] : null)
  || process.env.UI_EVIDENCE_DATE
  || new Date().toISOString().slice(0, 10);

const repoRoot = path.resolve(process.cwd(), '..', '..');
const evidenceDir = path.join(repoRoot, 'frontend-ui-evidence', runDate);
const videoDir = path.join(evidenceDir, 'videos');
const metaDir = path.join(evidenceDir, 'showcase-artifacts');
const dateStamp = runDate.replace(/-/g, '');
const inputVideoPath = path.join(videoDir, `UI_PhuHuynh_Full_Workflow_VI_${dateStamp}.webm`);
const outputVideoPath = path.join(videoDir, `UI_PhuHuynh_Full_Workflow_VI_${dateStamp}.mp4`);

async function latestParentArtifactDir() {
  const entries = await readdir(metaDir, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('parent-demo-'))
    .map((entry) => path.join(metaDir, entry.name));

  if (directories.length === 0) {
    throw new Error(`[render-parent-demo-mp4] No parent-demo-* directory found in ${metaDir}`);
  }

  const dated = await Promise.all(
    directories.map(async (directory) => ({
      directory,
      mtimeMs: (await stat(directory)).mtimeMs,
    })),
  );

  dated.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return dated[0].directory;
}

async function main() {
  await stat(inputVideoPath);
  const artifactDir = await latestParentArtifactDir();

  await renderNarratedVideo({
    logPrefix: 'render-parent-demo-mp4',
    inputVideoPath,
    outputVideoPath,
    artifactDir,
    voiceoverTitle: 'Kich ban long tieng Phu huynh',
    tempDirPrefix: 'parent-demo-narration-',
  });

  console.log(`[render-parent-demo-mp4] Output: ${outputVideoPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
