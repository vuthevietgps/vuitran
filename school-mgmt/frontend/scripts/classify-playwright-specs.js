const fs = require('node:fs/promises');
const path = require('node:path');

const CATEGORY_ORDER = ['evidence-recorder', 'api-integration', 'browser-ui'];

function parseArgs(argv) {
  const args = {
    rootDir: path.resolve(__dirname, '..', 'e2e'),
    outputDir: path.resolve(__dirname, '..', '..', 'test-results', 'playwright-spec-inventory'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root' && argv[index + 1]) {
      args.rootDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith('--root=')) {
      args.rootDir = path.resolve(value.slice('--root='.length));
      continue;
    }

    if (value === '--output-dir' && argv[index + 1]) {
      args.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith('--output-dir=')) {
      args.outputDir = path.resolve(value.slice('--output-dir='.length));
      continue;
    }

    if (value === '--help' || value === '-h') {
      args.help = true;
    }
  }

  return args;
}

async function walkSpecFiles(dir, results = []) {
  let entries = [];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return results;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkSpecFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && /\.spec\.tsx?$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function scoreByPattern(source, patterns) {
  let score = 0;
  const reasons = [];

  for (const { regex, points, reason } of patterns) {
    if (regex.test(source)) {
      score += points;
      reasons.push(reason);
    }
  }

  return { score, reasons };
}

function classifySpec(filePath, source) {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
  const normalizedSource = source.toLowerCase();

  const evidenceSignals = [
    { regex: /\/e2e\/.*(?:video|evidence|orchestrator)/i, points: 4, reason: 'path points to evidence-heavy or orchestrator suites' },
    { regex: /(collect-evidence|mark-logs-pass|quarantine-unsafe-evidence)/i, points: 6, reason: 'references evidence quarantine tooling' },
    { regex: /\b(video|trace|artifact|evidence|recording|screenshot|webm|mp4)\b/i, points: 3, reason: 'uses evidence/artifact vocabulary' },
    { regex: /\bexpect\.soft\b/i, points: 1, reason: 'soft expectations often accompany artifact collection' },
    { regex: /\btoHaveScreenshot\b/i, points: 2, reason: 'screenshot assertions are evidence-centric' },
    { regex: /\bpage\.screenshot\b/i, points: 2, reason: 'captures screenshots as artifacts' },
  ];

  const apiSignals = [
    { regex: /(^|\/)api(\/|$)/i, points: 4, reason: 'path is under api integration scope' },
    { regex: /\b(apiJson|apiCall|request\.fetch|request\.post|request\.get|request\.patch|request\.put|request\.delete)\b/i, points: 4, reason: 'uses request-level API helpers' },
    { regex: /\bAPIRequestContext\b/i, points: 3, reason: 'uses Playwright APIRequestContext' },
    { regex: /\bresponse\.status\(\)|\bresponse\.json\(/i, points: 1, reason: 'asserts on raw API responses' },
  ];

  const uiSignals = [
    { regex: /\b(page\.|locator\(|getByRole\(|getByText\(|getByLabel\(|getByPlaceholder\(|dragTo\(|fill\(|click\(|check\(|uncheck\(|selectOption\()/i, points: 3, reason: 'drives browser UI interactions' },
    { regex: /\btoBeVisible\b|\btoHaveURL\b|\btoHaveText\b|\btoHaveCount\b/i, points: 1, reason: 'asserts on rendered UI state' },
    { regex: /\bexpect\(page\./i, points: 1, reason: 'asserts on page-level browser state' },
  ];

  const evidence = scoreByPattern(`${normalizedPath}\n${normalizedSource}`, evidenceSignals);
  const api = scoreByPattern(`${normalizedPath}\n${normalizedSource}`, apiSignals);
  const ui = scoreByPattern(`${normalizedPath}\n${normalizedSource}`, uiSignals);

  const scores = {
    'browser-ui': ui.score,
    'api-integration': api.score,
    'evidence-recorder': evidence.score,
  };

  const bestCategory = CATEGORY_ORDER.reduce((winner, category) => {
    if (!winner) {
      return category;
    }

    if (scores[category] > scores[winner]) {
      return category;
    }

    return winner;
  }, null);

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sortedScores[0]?.[1] || 0;
  const secondScore = sortedScores[1]?.[1] || 0;
  const confidence = topScore >= secondScore + 3 ? 'high' : topScore >= secondScore + 1 ? 'medium' : 'low';

  const reasons = {
    'browser-ui': ui.reasons,
    'api-integration': api.reasons,
    'evidence-recorder': evidence.reasons,
  };

  return {
    file: path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/'),
    category: bestCategory,
    confidence,
    scores,
    reasons: reasons[bestCategory],
  };
}

function formatMarkdown(report) {
  const lines = [
    '# Playwright Spec Inventory',
    '',
    `Generated: ${report.generatedAt}`,
    `Root: \`${report.rootDir}\``,
    `Specs scanned: ${report.specCount}`,
    '',
    '## Summary',
  ];

  for (const category of CATEGORY_ORDER) {
    const bucket = report.categories[category];
    lines.push(`- ${category}: ${bucket.count}`);
  }

  lines.push('', '## Classified Specs');

  for (const category of CATEGORY_ORDER) {
    const bucket = report.categories[category];
    lines.push(`### ${category}`);

    if (bucket.files.length === 0) {
      lines.push('- none');
      lines.push('');
      continue;
    }

    for (const file of bucket.files) {
      const reasonText = file.reasons.length > 0 ? ` - ${file.reasons.join('; ')}` : '';
      lines.push(`- \`${file.file}\` (${file.confidence}, score ${file.scores[file.category]})${reasonText}`);
    }

    lines.push('');
  }

  lines.push(
    '## Heuristic Limits',
    '- Static keyword matching can misclassify mixed specs.',
    '- Review `api-integration` and `evidence-recorder` buckets manually when a spec mixes browser, API, and artifact checks.',
  );

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node scripts/classify-playwright-specs.js [--root <dir>] [--output-dir <dir>]');
    console.log('Writes JSON and Markdown reports for browser-ui / api-integration / evidence-recorder classification.');
    process.exitCode = 0;
    return;
  }

  const specFiles = await walkSpecFiles(args.rootDir);
  const classified = [];

  for (const filePath of specFiles) {
    const source = await fs.readFile(filePath, 'utf8');
    classified.push(classifySpec(filePath, source));
  }

  const categories = {
    'browser-ui': { count: 0, files: [] },
    'api-integration': { count: 0, files: [] },
    'evidence-recorder': { count: 0, files: [] },
  };

  for (const item of classified) {
    const bucket = categories[item.category];
    bucket.count += 1;
    bucket.files.push(item);
  }

  for (const category of CATEGORY_ORDER) {
    categories[category].files.sort((left, right) => left.file.localeCompare(right.file));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    rootDir: args.rootDir,
    specCount: specFiles.length,
    categories,
    files: classified.sort((left, right) => left.file.localeCompare(right.file)),
  };

  await fs.mkdir(args.outputDir, { recursive: true });

  const jsonPath = path.join(args.outputDir, 'playwright-spec-inventory.json');
  const markdownPath = path.join(args.outputDir, 'playwright-spec-inventory.md');

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, formatMarkdown(report), 'utf8');

  console.log(`[classify-playwright-specs] Scanned ${report.specCount} spec files.`);
  console.log(`[classify-playwright-specs] JSON report: ${jsonPath}`);
  console.log(`[classify-playwright-specs] Markdown report: ${markdownPath}`);
  for (const category of CATEGORY_ORDER) {
    console.log(`[classify-playwright-specs] ${category}: ${categories[category].count}`);
  }
}

main().catch((error) => {
  console.error('[classify-playwright-specs] Failed:', error);
  process.exitCode = 1;
});

module.exports = {
  classifySpec,
  formatMarkdown,
  parseArgs,
};
