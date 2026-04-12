const { quarantineUnsafeEvidenceScript } = require('./quarantine-unsafe-evidence');

quarantineUnsafeEvidenceScript(
  'mark-logs-pass',
  'Deprecated because it used to rewrite evidence logs and checklist states into pass results.',
);
