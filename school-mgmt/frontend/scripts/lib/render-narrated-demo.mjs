import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_NARRATION_GAP_MS = 450;
const EDGE_TTS_VOICE = process.env.EDGE_TTS_VOICE || 'vi-VN-HoaiMyNeural';
const DEFAULT_EDGE_TTS_MAX_CHARS = 55;
const EDGE_TTS_MAX_ATTEMPTS = 6;
const EDGE_TTS_RETRY_BASE_DELAY_MS = 1200;
const GTTS_LANGUAGE = 'vi';
const GTTS_MAX_ATTEMPTS = 4;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    ...options,
  });
  if (result.status !== 0) {
    const details = [
      `[${options.logPrefix || 'render-narrated-demo'}] Command failed: ${command} ${args.join(' ')}`,
      result.stdout || '',
      result.stderr || '',
    ].filter(Boolean).join('\n');
    throw new Error(details);
  }
  return result;
}

function maybeRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    ...options,
  });
  return result.status === 0 ? result : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePythonLauncher() {
  const candidates = [
    ['py', ['-3']],
    ['python', []],
    ['py', []],
  ];

  for (const [command, prefix] of candidates) {
    const probe = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8', stdio: 'pipe' });
    if (probe.status === 0) {
      return { command, prefix };
    }
  }

  return null;
}

function ensureEdgeTts(python, logPrefix) {
  const probe = spawnSync(
    python.command,
    [...python.prefix, '-m', 'edge_tts', '--help'],
    { encoding: 'utf8', stdio: 'pipe' },
  );
  if (probe.status === 0) {
    return true;
  }

  console.log(`[${logPrefix}] edge-tts not found, installing...`);
  const install = spawnSync(
    python.command,
    [...python.prefix, '-m', 'pip', 'install', '--user', 'edge-tts'],
    { encoding: 'utf8', stdio: 'inherit' },
  );
  if (install.status !== 0) {
    return false;
  }

  const verify = spawnSync(
    python.command,
    [...python.prefix, '-m', 'edge_tts', '--help'],
    { encoding: 'utf8', stdio: 'pipe' },
  );
  return verify.status === 0;
}

function ensureGtts(python, logPrefix) {
  const probe = spawnSync(
    python.command,
    [...python.prefix, '-c', 'from gtts import gTTS; print("ok")'],
    { encoding: 'utf8', stdio: 'pipe' },
  );
  if (probe.status === 0) {
    return true;
  }

  console.log(`[${logPrefix}] gTTS not found, installing...`);
  const install = spawnSync(
    python.command,
    [...python.prefix, '-m', 'pip', 'install', '--user', 'gTTS'],
    { encoding: 'utf8', stdio: 'inherit' },
  );
  if (install.status !== 0) {
    return false;
  }

  const verify = spawnSync(
    python.command,
    [...python.prefix, '-c', 'from gtts import gTTS; print("ok")'],
    { encoding: 'utf8', stdio: 'pipe' },
  );
  return verify.status === 0;
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

function synthesizeWithPowerShell(text, outputPath, logPrefix) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Speech',
    '$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$voice.Rate = 0',
    '$voice.SetOutputToWaveFile(' + `'${escapePowerShellSingleQuoted(outputPath)}'` + ')',
    '$voice.Speak(' + `'${escapePowerShellSingleQuoted(text)}'` + ')',
    '$voice.Dispose()',
  ].join('; ');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  run('powershell', ['-NoProfile', '-EncodedCommand', encoded], { logPrefix });
}

async function synthesizeWithEdgeTts(python, text, outputPath, logPrefix) {
  let lastError = null;

  for (let attempt = 1; attempt <= EDGE_TTS_MAX_ATTEMPTS; attempt += 1) {
    const result = spawnSync(
      python.command,
      [
        ...python.prefix,
        '-m',
        'edge_tts',
        '--voice',
        EDGE_TTS_VOICE,
        '--rate',
        '+0%',
        '--text',
        text,
        '--write-media',
        outputPath,
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );

    if (result.status === 0) {
      return { attemptsUsed: attempt };
    }

    const details = [result.stdout || '', result.stderr || ''].filter(Boolean).join('\n');
    lastError = new Error(details || 'edge-tts failed');

    if (attempt < EDGE_TTS_MAX_ATTEMPTS) {
      console.warn(
        `[${logPrefix}] edge-tts attempt ${attempt}/${EDGE_TTS_MAX_ATTEMPTS} failed for ${text.length} chars. Retrying...`,
      );
      await sleep(EDGE_TTS_RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

async function synthesizeWithGtts(python, text, outputPath, logPrefix) {
  const script = [
    'from gtts import gTTS',
    'import sys',
    'text = sys.argv[1]',
    'output_path = sys.argv[2]',
    `gTTS(text=text, lang='${GTTS_LANGUAGE}', slow=False).save(output_path)`,
  ].join('\n');

  let lastError = null;

  for (let attempt = 1; attempt <= GTTS_MAX_ATTEMPTS; attempt += 1) {
    const result = spawnSync(
      python.command,
      [...python.prefix, '-c', script, text, outputPath],
      { encoding: 'utf8', stdio: 'pipe' },
    );

    if (result.status === 0) {
      return { attemptsUsed: attempt };
    }

    const details = [result.stdout || '', result.stderr || ''].filter(Boolean).join('\n');
    lastError = new Error(details || 'gTTS failed');

    if (attempt < GTTS_MAX_ATTEMPTS) {
      console.warn(
        `[${logPrefix}] gTTS attempt ${attempt}/${GTTS_MAX_ATTEMPTS} failed for ${text.length} chars. Retrying...`,
      );
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}

function splitTextForEdgeTts(text, maxChars = DEFAULT_EDGE_TTS_MAX_CHARS) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const sentenceParts = normalized.match(/[^.!?;:]+[.!?;:]*/g) || [normalized];
  const chunks = [];

  const flushByWords = (fragment) => {
    const words = fragment.trim().split(/\s+/).filter(Boolean);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars || !current) {
        current = candidate;
        continue;
      }

      chunks.push(current.trim());
      current = word;
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }
  };

  let currentChunk = '';

  for (const sentence of sentenceParts.map((part) => part.trim()).filter(Boolean)) {
    if (sentence.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      const commaParts = sentence.split(/,\s*/).filter(Boolean);
      if (commaParts.length > 1) {
        for (let index = 0; index < commaParts.length; index += 1) {
          const fragment = index < commaParts.length - 1 ? `${commaParts[index]},` : commaParts[index];
          if (fragment.length <= maxChars) {
            chunks.push(fragment.trim());
          } else {
            flushByWords(fragment);
          }
        }
      } else {
        flushByWords(sentence);
      }
      continue;
    }

    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      currentChunk = candidate;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function concatAudioSegments(inputPaths, outputPath, logPrefix) {
  if (inputPaths.length === 0) {
    throw new Error(`[${logPrefix}] No input paths provided for audio concat.`);
  }

  const ffmpegArgs = inputPaths.flatMap((inputPath) => ['-i', inputPath]);
  const concatFilter = `${inputPaths.map((_, index) => `[${index}:a]`).join('')}concat=n=${inputPaths.length}:v=0:a=1[aout]`;

  run(
    'ffmpeg',
    [
      '-y',
      ...ffmpegArgs,
      '-filter_complex',
      concatFilter,
      '-map',
      '[aout]',
      '-ar',
      '24000',
      '-ac',
      '1',
      outputPath,
    ],
    { logPrefix },
  );
}

async function synthesizeWithEdgeTtsChunked(python, text, outputPath, chunkDir, logPrefix) {
  const chunks = splitTextForEdgeTts(text);
  if (chunks.length === 0) {
    throw new Error(`[${logPrefix}] Cannot synthesize empty text with edge-tts.`);
  }

  if (chunks.length === 1) {
    await synthesizeWithEdgeTts(python, chunks[0], outputPath, logPrefix);
    return { chunksUsed: 1 };
  }

  await mkdir(chunkDir, { recursive: true });
  const partPaths = chunks.map((_, index) => path.join(chunkDir, `part-${String(index + 1).padStart(2, '0')}.mp3`));
  for (let index = 0; index < chunks.length; index += 1) {
    await synthesizeWithEdgeTts(python, chunks[index], partPaths[index], logPrefix);
    if (index < chunks.length - 1) {
      await sleep(250);
    }
  }

  concatAudioSegments(partPaths, outputPath, logPrefix);
  return { chunksUsed: chunks.length };
}

function ffprobeDurationSeconds(filePath, logPrefix) {
  const ffprobePath = maybeRun('where.exe', ['ffprobe']) ? 'ffprobe' : 'ffprobe';
  const probe = run(
    ffprobePath,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    { logPrefix },
  );
  return Number((probe.stdout || '').trim());
}

function formatCueTimestamp(atMs) {
  const totalSeconds = Math.floor(Math.max(0, Number(atMs || 0)) / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function scheduleNarrationSegments(segments, gapMs) {
  let nextAvailableMs = 0;

  return [...segments]
    .sort((left, right) => Number(left.atMs || 0) - Number(right.atMs || 0))
    .map((segment) => {
      const requestedStartMs = Math.max(0, Number(segment.atMs || 0));
      const scheduledStartMs = Math.max(requestedStartMs, nextAvailableMs);
      const durationMs = Math.ceil(Number(segment.durationSeconds || 0) * 1000);
      const endMs = scheduledStartMs + durationMs;
      nextAvailableMs = endMs + gapMs;

      return {
        ...segment,
        requestedStartMs,
        scheduledStartMs,
        endMs,
        overlapAdjusted: scheduledStartMs !== requestedStartMs,
      };
    });
}

function escapeMarkdownCell(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

async function writeVoiceoverScript(artifactDir, title, segments, gapMs) {
  const lines = [
    `# ${title}`,
    '',
    'Kịch bản lồng tiếng đã được dàn lại theo thứ tự phát thực tế để tránh chồng giọng giữa các cảnh.',
    '',
    `Khoảng đệm giữa hai cue liên tiếp: ${gapMs}ms.`,
    '',
    '| Cue | Mốc gốc | Mốc phát | Kết thúc | Điều chỉnh | Section | Text |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...segments.map((segment) => (
      `| ${segment.id} | ${formatCueTimestamp(segment.requestedStartMs)} | ${formatCueTimestamp(segment.scheduledStartMs)} | ${formatCueTimestamp(segment.endMs)} | ${segment.overlapAdjusted ? 'Có' : 'Không'} | ${escapeMarkdownCell(segment.section)} | ${escapeMarkdownCell(segment.text)} |`
    )),
    '',
  ];

  await writeFile(path.join(artifactDir, 'voiceover-script.md'), lines.join('\n'), 'utf8');
}

export async function renderNarratedVideo({
  logPrefix,
  inputVideoPath,
  outputVideoPath,
  artifactDir,
  voiceoverTitle,
  tempDirPrefix,
  gapMs = DEFAULT_NARRATION_GAP_MS,
}) {
  await stat(inputVideoPath);

  const cuePath = path.join(artifactDir, 'narration-cues.json');
  const cues = JSON.parse(await readFile(cuePath, 'utf8'));

  if (!Array.isArray(cues) || cues.length === 0) {
    throw new Error(`[${logPrefix}] No narration cues found in ${cuePath}`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), tempDirPrefix));
  const python = resolvePythonLauncher();
  const canUseGtts = python ? ensureGtts(python, logPrefix) : false;
  const canUseEdgeTts = python ? ensureEdgeTts(python, logPrefix) : false;
  const generatedSegments = [];

  try {
    for (const cue of cues) {
      const extension = canUseGtts || canUseEdgeTts ? 'mp3' : 'wav';
      const segmentPath = path.join(tempDir, `${cue.id}.${extension}`);
      const defaultEngine = canUseGtts
        ? `gtts:${GTTS_LANGUAGE}`
        : canUseEdgeTts
          ? `edge-tts:${EDGE_TTS_VOICE}`
          : 'powershell:System.Speech';
      const edgeEngine = `edge-tts:${EDGE_TTS_VOICE}`;

      if (canUseGtts) {
        try {
          await synthesizeWithGtts(python, cue.text, segmentPath, logPrefix);
          generatedSegments.push({
            ...cue,
            path: segmentPath,
            durationSeconds: ffprobeDurationSeconds(segmentPath, logPrefix),
            engineUsed: defaultEngine,
          });
          continue;
        } catch (error) {
          console.warn(`[${logPrefix}] gTTS failed for ${cue.id}, trying edge-tts fallback.`);
        }
      }

      if (canUseEdgeTts) {
        try {
          const chunkDir = path.join(tempDir, `${cue.id}-chunks`);
          const { chunksUsed } = await synthesizeWithEdgeTtsChunked(python, cue.text, segmentPath, chunkDir, logPrefix);
          generatedSegments.push({
            ...cue,
            path: segmentPath,
            durationSeconds: ffprobeDurationSeconds(segmentPath, logPrefix),
            engineUsed: chunksUsed > 1 ? `${edgeEngine}:chunked-${chunksUsed}` : edgeEngine,
          });
          continue;
        } catch (error) {
          console.warn(`[${logPrefix}] edge-tts failed for ${cue.id}, falling back to PowerShell TTS.`);
        }
      }

      const fallbackPath = path.join(tempDir, `${cue.id}.wav`);
      synthesizeWithPowerShell(cue.text, fallbackPath, logPrefix);
      generatedSegments.push({
        ...cue,
        path: fallbackPath,
        durationSeconds: ffprobeDurationSeconds(fallbackPath, logPrefix),
        engineUsed: 'powershell:System.Speech',
      });
    }

    const scheduledSegments = scheduleNarrationSegments(generatedSegments, gapMs);
    const uniqueEngines = [...new Set(scheduledSegments.map((segment) => segment.engineUsed))];
    const narrationEngine =
      uniqueEngines.length === 1 ? uniqueEngines[0] : `mixed:${uniqueEngines.join(',')}`;

    const audioArgs = scheduledSegments.flatMap((segment) => ['-i', segment.path]);
    const delayedLabels = scheduledSegments.map((segment, index) => `[a${index + 1}]`);
    const filterParts = scheduledSegments.map((segment, index) => {
      const delayMs = Math.max(0, Number(segment.scheduledStartMs || 0));
      return `[${index + 1}:a]adelay=${delayMs}|${delayMs}${delayedLabels[index]}`;
    });

    filterParts.push(
      `${delayedLabels.join('')}amix=inputs=${scheduledSegments.length}:dropout_transition=0:normalize=0[aout]`,
    );

    run(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputVideoPath,
        ...audioArgs,
        '-filter_complex',
        filterParts.join(';'),
        '-map',
        '0:v:0',
        '-map',
        '[aout]',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        outputVideoPath,
      ],
      { stdio: 'inherit', logPrefix },
    );

    await cp(outputVideoPath, path.join(artifactDir, path.basename(outputVideoPath)));
    await writeVoiceoverScript(artifactDir, voiceoverTitle, scheduledSegments, gapMs);
    await writeFile(
      path.join(artifactDir, 'render-manifest.json'),
      JSON.stringify(
        {
          inputVideoPath,
          outputVideoPath,
          narrationEngine,
          gapMs,
          cues: scheduledSegments.map((segment) => ({
            id: segment.id,
            atMs: segment.atMs,
            requestedStartMs: segment.requestedStartMs,
            scheduledStartMs: segment.scheduledStartMs,
            endMs: segment.endMs,
            overlapAdjusted: segment.overlapAdjusted,
            section: segment.section,
            text: segment.text,
            durationSeconds: segment.durationSeconds,
            engineUsed: segment.engineUsed,
          })),
        },
        null,
        2,
      ),
      'utf8',
    );

    return {
      narrationEngine,
      scheduledSegments,
      voiceoverScriptPath: path.join(artifactDir, 'voiceover-script.md'),
      renderManifestPath: path.join(artifactDir, 'render-manifest.json'),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
