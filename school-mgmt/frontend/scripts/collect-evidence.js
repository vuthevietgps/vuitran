const { quarantineUnsafeEvidenceScript } = require('./quarantine-unsafe-evidence');

quarantineUnsafeEvidenceScript(
  'collect-evidence',
  'Deprecated because it copied media into evidence folders without validating the runner output.',
);
