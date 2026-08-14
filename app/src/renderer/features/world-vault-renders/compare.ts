/**
 * The comparison surface's two halves: a real, word-level region/chunk diff
 * that needs no renderer at all, and an on-demand visual comparison that
 * serves two already-finished renders and opens them, side by side, in the
 * user's own browser.
 *
 * The visual half deliberately never runs inside this application's own
 * window. The renderer's generated web application is a third-party bundle
 * with its own scripts, and this application's Content-Security-Policy
 * refuses every frame (`frame-src 'none'`) and inline script — loosening
 * either would be a change to `app/src/main/index.ts`, which this feature
 * does not own and which the wider contract forbids weakening for one
 * feature's convenience anyway. Opening it externally is exactly the route
 * `../worldlens/panel.ts` already uses for the same family of renderer, so
 * this is a proven pattern rather than an invented workaround.
 */

import type { StudioApi } from '../../../shared/api';
import { DIMENSION_REGION_PATHS, diffRegionHeaders, regionFileCoords } from '../../../shared/anvil';
import { isErrorLine, parseListeningLine, stripLogPrefix } from './logParsing';
import { pickServePort, serveArguments, writeServePort } from './renderConfig';
import { rendererLauncher } from './probe';
import { readRegionHeaderViaStudio } from './regionReader';
import type { CompareMode, RendererKind } from './types';

function joinPath(base: string, ...segments: string[]): string {
  const sep = base.includes('\\') && !base.startsWith('/') ? '\\' : '/';
  let out = base.replace(/[\\/]+$/, '');
  for (const segment of segments) {
    const clean = segment.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (clean !== '') out += sep + clean;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Word diff — real, always available, needs no renderer               */
/* ------------------------------------------------------------------ */

export interface RegionDiffRow {
  dimension: string;
  regionFile: string;
  status: 'added' | 'removed' | 'changed';
  addedChunks: number;
  removedChunks: number;
  changedChunks: number;
}

export interface WordDiffResult {
  regions: RegionDiffRow[];
  regionsCompared: number;
  totalChunksAdded: number;
  totalChunksRemoved: number;
  totalChunksChanged: number;
  /** Region files whose header could not be read at all — never silently skipped. */
  unreadable: Array<{ dimension: string; regionFile: string; reason: string }>;
  computedAt: string;
}

async function listRegionFileNames(studio: StudioApi, worldDirectory: string, segments: string[]): Promise<string[]> {
  const listing = await studio.fs.readDirectory(joinPath(worldDirectory, ...segments));
  if (!listing.ok) return [];
  return listing.value.filter((entry) => !entry.isDirectory && regionFileCoords(entry.name) !== null).map((entry) => entry.name);
}

/**
 * The renderer-side word diff, built on the whole-file `studio.fs.readBase64`
 * path (see `regionReader.ts`). Correct for any world this application can
 * reasonably hold in memory; a region file past the read ceiling is reported
 * in `unreadable` rather than silently excluded from the totals.
 */
export async function computeWordDiff(
  studio: StudioApi,
  worldDirectoryBefore: string,
  worldDirectoryAfter: string
): Promise<WordDiffResult> {
  const regions: RegionDiffRow[] = [];
  const unreadable: Array<{ dimension: string; regionFile: string; reason: string }> = [];
  let compared = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalChanged = 0;

  for (const { dimension, segments } of DIMENSION_REGION_PATHS) {
    const [beforeFiles, afterFiles] = await Promise.all([
      listRegionFileNames(studio, worldDirectoryBefore, segments),
      listRegionFileNames(studio, worldDirectoryAfter, segments)
    ]);
    const names = [...new Set([...beforeFiles, ...afterFiles])].sort();

    for (const name of names) {
      const coords = regionFileCoords(name);
      if (!coords) continue;
      compared += 1;
      const inBefore = beforeFiles.includes(name);
      const inAfter = afterFiles.includes(name);
      const beforePath = joinPath(worldDirectoryBefore, ...segments, name);
      const afterPath = joinPath(worldDirectoryAfter, ...segments, name);

      if (inBefore && !inAfter) {
        const header = await readRegionHeaderViaStudio(studio, beforePath);
        if (!header.ok) {
          unreadable.push({ dimension, regionFile: name, reason: describeReadFailure(header) });
          continue;
        }
        if (header.header.presentCount === 0) continue;
        regions.push({
          dimension,
          regionFile: name,
          status: 'removed',
          addedChunks: 0,
          removedChunks: header.header.presentCount,
          changedChunks: 0
        });
        totalRemoved += header.header.presentCount;
        continue;
      }

      if (!inBefore && inAfter) {
        const header = await readRegionHeaderViaStudio(studio, afterPath);
        if (!header.ok) {
          unreadable.push({ dimension, regionFile: name, reason: describeReadFailure(header) });
          continue;
        }
        if (header.header.presentCount === 0) continue;
        regions.push({
          dimension,
          regionFile: name,
          status: 'added',
          addedChunks: header.header.presentCount,
          removedChunks: 0,
          changedChunks: 0
        });
        totalAdded += header.header.presentCount;
        continue;
      }

      const [before, after] = await Promise.all([
        readRegionHeaderViaStudio(studio, beforePath),
        readRegionHeaderViaStudio(studio, afterPath)
      ]);
      if (!before.ok) {
        unreadable.push({ dimension, regionFile: name, reason: describeReadFailure(before) });
        continue;
      }
      if (!after.ok) {
        unreadable.push({ dimension, regionFile: name, reason: describeReadFailure(after) });
        continue;
      }
      const diff = diffRegionHeaders(before.header, after.header);
      if (diff.addedChunks === 0 && diff.removedChunks === 0 && diff.changedChunks === 0) continue;
      regions.push({
        dimension,
        regionFile: name,
        status: 'changed',
        addedChunks: diff.addedChunks,
        removedChunks: diff.removedChunks,
        changedChunks: diff.changedChunks
      });
      totalAdded += diff.addedChunks;
      totalRemoved += diff.removedChunks;
      totalChanged += diff.changedChunks;
    }
  }

  return {
    regions,
    regionsCompared: compared,
    totalChunksAdded: totalAdded,
    totalChunksRemoved: totalRemoved,
    totalChunksChanged: totalChanged,
    unreadable,
    computedAt: new Date().toISOString()
  };
}

function describeReadFailure(result: Awaited<ReturnType<typeof readRegionHeaderViaStudio>>): string {
  if (result.ok) return '';
  if (result.kind === 'too-large') {
    return `The file is ${String(result.fileSize)} bytes, past the ${String(result.limit)}-byte read limit; its chunk-level diff was not computed.`;
  }
  if (result.kind === 'truncated') return `The file is only ${String(result.fileSize)} bytes, smaller than a valid region header.`;
  return result.error;
}

/* ------------------------------------------------------------------ */
/* Visual comparison — serves two finished renders externally          */
/* ------------------------------------------------------------------ */

export interface ServeHandle {
  processId: string;
  port: number;
  url: string;
}

export type ServeOutcome = { ok: true; handle: ServeHandle } | { ok: false; error: string };

const SERVE_TIMEOUT_MS = 30_000;

/** Starts an on-demand webserver for one already-rendered commit's output. */
export async function startServe(
  studio: StudioApi,
  configDirectory: string,
  rendererPath: string,
  rendererKind: RendererKind
): Promise<ServeOutcome> {
  const launcher = rendererLauncher(rendererPath, rendererKind);
  if (!launcher) return { ok: false, error: 'The configured renderer path is neither a .jar nor a Node entry point.' };

  const port = pickServePort();
  const wrote = await writeServePort(studio, configDirectory, port);
  if (!wrote.ok) return { ok: false, error: wrote.error };

  const spawned = await studio.process.spawn({
    command: launcher.command,
    args: [...launcher.leading, ...serveArguments(configDirectory)],
    maxOutputBytes: 2 * 1024 * 1024
  });
  if (!spawned.ok) return { ok: false, error: spawned.error };

  return new Promise<ServeOutcome>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      void studio.process.kill(spawned.value.id);
      resolve({ ok: false, error: 'The renderer did not report itself listening within 30 seconds.' });
    }, SERVE_TIMEOUT_MS);

    const unsubscribe = studio.events.on('process:event', (event) => {
      if (event.id !== spawned.value.id || settled) return;
      if (event.kind === 'stdout' || event.kind === 'stderr') {
        for (const line of event.chunk.split(/\r?\n/)) {
          const listening = parseListeningLine(line);
          if (listening) {
            settled = true;
            clearTimeout(timer);
            unsubscribe();
            resolve({
              ok: true,
              handle: { processId: spawned.value.id, port: listening.port, url: `http://${listening.host}:${String(listening.port)}/` }
            });
            return;
          }
          if (isErrorLine(line) && !settled) {
            settled = true;
            clearTimeout(timer);
            unsubscribe();
            void studio.process.kill(spawned.value.id);
            resolve({ ok: false, error: stripLogPrefix(line) });
            return;
          }
        }
      }
      if (event.kind === 'error' && !settled) {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve({ ok: false, error: event.message });
      }
      if (event.kind === 'exit' && !settled) {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve({
          ok: false,
          error: `The renderer exited before it reported itself listening (code ${String(event.code)}).`
        });
      }
    });
  });
}

export async function stopServe(studio: StudioApi, processId: string): Promise<void> {
  await studio.process.kill(processId);
}

/**
 * A self-contained local HTML page, opened with the operating system's
 * default browser (never embedded in this application's own window — see the
 * module header). It carries a draggable reveal slider, a full toggle, and a
 * side-by-side layout, all driven by inline CSS/JS with no network asset of
 * any kind: both iframes point at loopback URLs this application just started.
 */
export function buildCompareHtml(
  left: { url: string; label: string },
  right: { url: string; label: string },
  mode: CompareMode
): string {
  const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>World Vault render comparison</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #101418; color: #e2e2e6; }
  header { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: #1a1f24; }
  header h1 { font-size: 14px; font-weight: 600; margin: 0; flex: 1; }
  .modes button { background: #262b31; color: #e2e2e6; border: 1px solid #3a4046; border-radius: 6px; padding: 6px 12px; margin-left: 6px; cursor: pointer; }
  .modes button[aria-pressed="true"] { background: #4c6a92; border-color: #4c6a92; }
  .labels { display: flex; padding: 6px 16px; gap: 16px; font-size: 12px; opacity: 0.8; }
  .stage { position: relative; width: 100%; height: calc(100vh - 74px); overflow: hidden; }
  .stage.side-by-side { display: flex; }
  .stage.side-by-side iframe { flex: 1 1 50%; width: 50%; height: 100%; border: 0; border-right: 1px solid #3a4046; }
  .stage.slider, .stage.toggle { }
  .stage.slider iframe, .stage.toggle iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .stage.slider iframe.right, .stage.toggle iframe.right { clip-path: inset(0 0 0 var(--reveal, 50%)); }
  .stage.toggle iframe.right { clip-path: none; visibility: hidden; }
  .stage.toggle[data-show="right"] iframe.right { visibility: visible; }
  .stage.toggle[data-show="right"] iframe.left { visibility: hidden; }
  .divider { position: absolute; top: 0; bottom: 0; left: var(--reveal, 50%); width: 4px; margin-left: -2px; background: #e2e2e6; cursor: ew-resize; display: none; }
  .stage.slider .divider { display: block; }
  input[type=range] { width: 200px; }
</style>
</head>
<body>
<header>
  <h1>World Vault render comparison</h1>
  <input id="revealInput" type="range" min="0" max="100" value="50" aria-label="Reveal position">
  <div class="modes" role="group" aria-label="Comparison mode">
    <button data-mode="slider" aria-pressed="${mode === 'slider'}">Slider</button>
    <button data-mode="toggle" aria-pressed="${mode === 'toggle'}">Toggle</button>
    <button data-mode="side-by-side" aria-pressed="${mode === 'side-by-side'}">Side by side</button>
  </div>
</header>
<div class="labels"><span>Left: ${escape(left.label)}</span><span>Right: ${escape(right.label)}</span></div>
<div id="stage" class="stage ${mode}" data-show="left">
  <iframe class="left" title="${escape(left.label)}" src="${escape(left.url)}"></iframe>
  <iframe class="right" title="${escape(right.label)}" src="${escape(right.url)}"></iframe>
  <div class="divider"></div>
</div>
<script>
  var stage = document.getElementById('stage');
  var reveal = document.getElementById('revealInput');
  var buttons = document.querySelectorAll('.modes button');
  reveal.addEventListener('input', function () {
    stage.style.setProperty('--reveal', reveal.value + '%');
  });
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      button.setAttribute('aria-pressed', 'true');
      stage.className = 'stage ' + button.dataset.mode;
      if (button.dataset.mode === 'toggle') {
        stage.dataset.show = stage.dataset.show === 'right' ? 'left' : 'right';
      }
    });
  });
  stage.addEventListener('click', function (event) {
    if (stage.className.indexOf('toggle') === -1) return;
    stage.dataset.show = stage.dataset.show === 'right' ? 'left' : 'right';
    event.preventDefault();
  });
</script>
</body>
</html>
`;
}
