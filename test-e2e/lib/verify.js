'use strict';
/*
 * Verifies what actually landed on disk: walks the output world directory for
 * real Anvil region files, opens each one and reads its real header (see
 * `region.js`), and compares the resulting set of saved chunk coordinates
 * against the set the bot's route says it should have visited.
 *
 * This is the whole point of the harness. A run that finished cleanly and
 * produced no world has failed, however green its process exit codes looked —
 * so this module never reports success from "the child processes exited
 * without error"; it reports success only from bytes actually read back from
 * the region files the downloader wrote.
 */

const fsp = require('node:fs/promises');
const path = require('node:path');
const { parseRegionHeader, parseRegionFileName } = require('./region');

const MAX_DEPTH = 4;
const MAX_ENTRIES = 20000;

/**
 * Walks the world directory the same way the desktop application's own probe
 * does (`app/src/renderer/features/downloader/runtime.ts#scanWorld`): bounded
 * depth, skips the `overview`/`debug` helper directories, and records which
 * dimension each `region`/`entities` folder belongs to from its parent
 * directory name.
 */
async function findRegionFiles(worldDir) {
  const results = [];
  let seen = 0;

  async function walk(dir, depth, dimension) {
    if (depth > MAX_DEPTH || seen > MAX_ENTRIES) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return; // an unreadable or missing subdirectory does not invalidate the rest of the walk
    }
    for (const entry of entries) {
      seen += 1;
      if (seen > MAX_ENTRIES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'overview' || entry.name === 'debug') continue;
        const nextDimension = entry.name === 'region' || entry.name === 'entities' || entry.name === 'poi' ? dimension : entry.name;
        await walk(full, depth + 1, nextDimension);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith('.mca')) continue;
      const parentName = path.basename(dir);
      const kind = parentName === 'entities' ? 'entities' : 'region';
      const coords = parseRegionFileName(entry.name);
      if (!coords) continue;
      results.push({ path: full, name: entry.name, kind, dimension: dimension === '' ? 'overworld' : dimension, coords });
    }
  }

  await walk(worldDir, 0, '');
  return results;
}

/**
 * Reads every region (not entities — entities carry no location data useful
 * for this comparison) file's header and returns the union of saved chunk
 * coordinates, per dimension.
 */
async function readSavedChunks(worldDir) {
  const files = await findRegionFiles(worldDir);
  const perDimension = new Map();
  let filesRead = 0;
  let filesUnreadable = 0;
  const unreadableNames = [];

  for (const file of files) {
    if (file.kind !== 'region') continue;
    let buffer;
    try {
      buffer = await fsp.readFile(file.path);
    } catch (error) {
      filesUnreadable += 1;
      unreadableNames.push(`${file.dimension}/${file.name}`);
      continue;
    }
    filesRead += 1;
    const { chunks } = parseRegionHeader(buffer, file.coords.x, file.coords.z);
    const bucket = perDimension.get(file.dimension) ?? new Set();
    for (const chunk of chunks) bucket.add(chunk.x + ',' + chunk.z);
    perDimension.set(file.dimension, bucket);
  }

  return { filesFound: files.length, filesRead, filesUnreadable, unreadableNames, perDimension };
}

/**
 * Compares what is actually saved (in the "overworld" dimension, where the
 * bot's route lives) against the expected chunk set from the route the bot
 * was told to walk.
 */
async function verifyWorld({ worldDir, expectedChunkKeys, dimension = 'overworld' }) {
  const saved = await readSavedChunks(worldDir);
  const savedInDimension = saved.perDimension.get(dimension) ?? new Set();

  let matched = 0;
  const missing = [];
  for (const key of expectedChunkKeys) {
    if (savedInDimension.has(key)) matched += 1;
    else missing.push(key);
  }

  const totalSavedAcrossDimensions = [...saved.perDimension.values()].reduce((sum, set) => sum + set.size, 0);

  return {
    worldExists: saved.filesFound > 0 || (await pathExists(worldDir)),
    filesFound: saved.filesFound,
    filesRead: saved.filesRead,
    filesUnreadable: saved.filesUnreadable,
    unreadableNames: saved.unreadableNames,
    dimensions: [...saved.perDimension.keys()],
    savedInDimensionCount: savedInDimension.size,
    totalSavedAcrossDimensions,
    expectedCount: expectedChunkKeys.length,
    matchedCount: matched,
    missingCount: missing.length,
    missingSample: missing.slice(0, 25),
    coverageRatio: expectedChunkKeys.length === 0 ? 1 : matched / expectedChunkKeys.length
  };
}

async function pathExists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

module.exports = { findRegionFiles, readSavedChunks, verifyWorld };
