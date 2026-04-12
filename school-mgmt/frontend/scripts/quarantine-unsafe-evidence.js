const QUARANTINED_SCRIPTS = {
  'mark-logs-pass': {
    summary: 'This script rewrote evidence logs and checklist states to look green.',
    replacement: 'Use the raw Playwright JUnit + HTML reports and unmodified artifacts only.',
  },
  'collect-evidence': {
    summary: 'This script copied the latest media files into evidence folders without runner-level validation.',
    replacement: 'Use Playwright trace/video attachments and the new spec inventory report instead.',
  },
};

function renderMessage(scriptName, extraReason) {
  const meta = QUARANTINED_SCRIPTS[scriptName] || null;
  const lines = [
    `[${scriptName}] quarantined: unsafe evidence mutation is disabled.`,
    meta?.summary || 'This entrypoint is no longer allowed to mutate evidence or infer pass status.',
    meta?.replacement || 'Use the generated test reports and raw artifacts instead.',
  ];

  if (extraReason) {
    lines.push(extraReason);
  }

  lines.push('Exit code 1 is intentional.');
  return lines;
}

function quarantineUnsafeEvidenceScript(scriptName, extraReason) {
  for (const line of renderMessage(scriptName, extraReason)) {
    console.error(line);
  }

  process.exitCode = 1;
}

if (require.main === module) {
  const scriptName = process.argv[2] || 'unknown-script';
  const extraReason = process.argv.slice(3).join(' ').trim() || undefined;
  quarantineUnsafeEvidenceScript(scriptName, extraReason);
}

module.exports = {
  quarantineUnsafeEvidenceScript,
  QUARANTINED_SCRIPTS,
};
