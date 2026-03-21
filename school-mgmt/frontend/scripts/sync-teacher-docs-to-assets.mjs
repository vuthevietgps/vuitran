import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const sourceDir = path.join(repoRoot, 'docs', 'teacher');
const targetDir = path.join(frontendRoot, 'src', 'assets', 'teacher-docs');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source docs folder not found: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);
  copyRecursive(sourceDir, targetDir);
  console.log(`Synced teacher docs to ${targetDir}`);
}

main();
