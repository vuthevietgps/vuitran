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
const inputVideoPath = path.join(videoDir, `UI_GiaoVien_Full_Workflow_VI_${dateStamp}.webm`);
const outputVideoPath = path.join(videoDir, `UI_GiaoVien_Full_Workflow_VI_${dateStamp}.mp4`);

async function latestTeacherArtifactDir() {
  const entries = await readdir(metaDir, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('teacher-demo-'))
    .map((entry) => path.join(metaDir, entry.name));

  if (directories.length === 0) {
    throw new Error(`[render-teacher-demo-mp4] No teacher-demo-* directory found in ${metaDir}`);
  }

  const dated = await Promise.all(
    directories.map(async (directory) => ({
      directory,
      mtimeMs: (await stat(directory)).mtimeMs,
    })),
  );

  dated.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dated[0].directory;
}

async function main() {
  await stat(inputVideoPath);
  const artifactDir = await latestTeacherArtifactDir();

  await renderNarratedVideo({
    logPrefix: 'render-teacher-demo-mp4',
    inputVideoPath,
    outputVideoPath,
    artifactDir,
    voiceoverTitle: 'Kịch bản lồng tiếng Giáo viên',
    tempDirPrefix: 'teacher-demo-narration-',
  });

  console.log(`[render-teacher-demo-mp4] Output: ${outputVideoPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
