/**
 * The privileged worker script, as a string.
 *
 * There is no IPC channel for raw region-file bytes: `studio.fs` can read a
 * file as base64 but has no binary write, and a new channel would mean
 * editing `shared/channels.ts`, `shared/api.ts`, `main/ipc.ts` and
 * `preload/index.ts` — none of which this feature owns. What IS already
 * sanctioned is `studio.process.spawn({ command: 'node', ... })` (`node` is on
 * the application's allow-listed command list). So the actual Anvil/NBT
 * surgery runs as a real, unsandboxed `node` child process: this string is
 * written to a real file with `studio.fs.writeText` and then spawned.
 *
 * It is a line-by-line transliteration of the canonical, independently tested
 * TypeScript implementation at `app/src/main/features/world-vault-edit.ts` —
 * read that file's own header comment for the full byte-layout citations
 * (`McaFile.java`, `ChunkBinary.java`, `Chunk.java`, `ChunkEntities.java`).
 * Keep the two in lock-step; `worker-source.test.ts` spawns THIS exact string
 * as a real process against real fixtures, independent of the TypeScript
 * reference, so a divergence between them fails a test rather than shipping
 * silently.
 *
 * Deliberately plain CommonJS with zero dependencies beyond Node's own
 * `fs`/`zlib`/`path`/`crypto`, so it runs on any Node the application already
 * requires (`engines.node` in `package.json`) with no build step of its own.
 */

export const WORKER_VERSION = 1;

export const REGION_EDIT_WORKER_SOURCE = `
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const SECTOR_SIZE = 4096;
const MAX_DEPTH = 128;
const MAX_LIST_ELEMENTS = 4000000;
const MAX_STRING_BYTES = 1000000;

function mod32(n) { return ((n % 32) + 32) % 32; }
function localIndex(localX, localZ) { return (localX & 31) + (localZ & 31) * 32; }
function describeError(e) { return e && e.message ? e.message : String(e); }

/* ---------------- NBT reader ---------------- */

function makeReader(buf) {
  return { buf: buf, offset: 0 };
}
function need(r, count) {
  var start = r.offset;
  if (start + count > r.buf.length) throw new Error('The NBT data ends in the middle of a tag; the chunk is truncated or corrupt.');
  r.offset = start + count;
  return start;
}
function rUbyte(r) { return r.buf.readUInt8(need(r, 1)); }
function rByte(r) { return r.buf.readInt8(need(r, 1)); }
function rShort(r) { return r.buf.readInt16BE(need(r, 2)); }
function rUshort(r) { return r.buf.readUInt16BE(need(r, 2)); }
function rInt(r) { return r.buf.readInt32BE(need(r, 4)); }
function rLong(r) { return r.buf.readBigInt64BE(need(r, 8)); }
function rFloat(r) { return r.buf.readFloatBE(need(r, 4)); }
function rDouble(r) { return r.buf.readDoubleBE(need(r, 8)); }
function rBytes(r, count) { var start = need(r, count); return r.buf.subarray(start, start + count); }
function rString(r) {
  var length = rUshort(r);
  if (length > MAX_STRING_BYTES) throw new Error('An NBT string claims ' + length + ' bytes, past the ' + MAX_STRING_BYTES + '-byte bound.');
  var start = need(r, length);
  return r.buf.toString('utf8', start, start + length);
}
function rAtEnd(r) { return r.offset >= r.buf.length; }
function readCount(r) {
  var count = rInt(r);
  if (count < 0 || count > MAX_LIST_ELEMENTS) throw new Error('An NBT list/array claims ' + count + ' entries, past the ' + MAX_LIST_ELEMENTS + ' bound.');
  return count;
}

function readPayload(r, type, depth) {
  if (depth > MAX_DEPTH) throw new Error('NBT nests deeper than ' + MAX_DEPTH + ' levels.');
  switch (type) {
    case 1: return { type: 1, value: rByte(r) };
    case 2: return { type: 2, value: rShort(r) };
    case 3: return { type: 3, value: rInt(r) };
    case 4: return { type: 4, value: rLong(r) };
    case 5: return { type: 5, value: rFloat(r) };
    case 6: return { type: 6, value: rDouble(r) };
    case 7: { var c7 = readCount(r); return { type: 7, value: new Uint8Array(rBytes(r, c7)) }; }
    case 8: return { type: 8, value: rString(r) };
    case 9: {
      var itemType = rUbyte(r);
      var count9 = readCount(r);
      var items = [];
      for (var i9 = 0; i9 < count9; i9++) items.push(readPayload(r, itemType, depth + 1));
      return { type: 9, value: items, itemType: itemType };
    }
    case 10: return { type: 10, value: readCompoundPayload(r, depth + 1) };
    case 11: {
      var c11 = readCount(r);
      var v11 = new Int32Array(c11);
      for (var i11 = 0; i11 < c11; i11++) v11[i11] = rInt(r);
      return { type: 11, value: v11 };
    }
    case 12: {
      var c12 = readCount(r);
      var v12 = new BigInt64Array(c12);
      for (var i12 = 0; i12 < c12; i12++) v12[i12] = rLong(r);
      return { type: 12, value: v12 };
    }
    default: throw new Error('Tag type ' + type + ' is not part of the NBT format.');
  }
}
function readCompoundPayload(r, depth) {
  if (depth > MAX_DEPTH) throw new Error('NBT nests deeper than ' + MAX_DEPTH + ' levels.');
  var compound = {};
  for (;;) {
    if (rAtEnd(r)) throw new Error('A compound tag is never closed with an end tag.');
    var tagType = rUbyte(r);
    if (tagType === 0) return compound;
    var name = rString(r);
    compound[name] = readPayload(r, tagType, depth + 1);
  }
}
function readNamedRoot(bytes) {
  var r = makeReader(bytes);
  var rootType = rUbyte(r);
  if (rootType !== 10) throw new Error('The chunk NBT does not begin with a compound tag.');
  var name = rString(r);
  var root = readCompoundPayload(r, 0);
  return { name: name, root: root };
}

/* ---------------- NBT writer ---------------- */

function makeWriter() { return { parts: [] }; }
function wPush(w, buf) { w.parts.push(buf); }
function wUbyte(w, v) { var b = Buffer.alloc(1); b.writeUInt8(v & 0xff, 0); wPush(w, b); }
function wByte(w, v) { var b = Buffer.alloc(1); b.writeInt8(v, 0); wPush(w, b); }
function wShort(w, v) { var b = Buffer.alloc(2); b.writeInt16BE(v, 0); wPush(w, b); }
function wInt(w, v) { var b = Buffer.alloc(4); b.writeInt32BE(v, 0); wPush(w, b); }
function wLong(w, v) { var b = Buffer.alloc(8); b.writeBigInt64BE(v, 0); wPush(w, b); }
function wFloat(w, v) { var b = Buffer.alloc(4); b.writeFloatBE(v, 0); wPush(w, b); }
function wDouble(w, v) { var b = Buffer.alloc(8); b.writeDoubleBE(v, 0); wPush(w, b); }
function wRaw(w, v) { wPush(w, Buffer.from(v)); }
function wString(w, s) {
  var utf8 = Buffer.from(s, 'utf8');
  if (utf8.length > 65535) throw new Error('An NBT string is longer than the format allows (65535 bytes).');
  wShort2(w, utf8.length);
  wPush(w, utf8);
}
function wShort2(w, v) { var b = Buffer.alloc(2); b.writeUInt16BE(v, 0); wPush(w, b); }

function writePayload(w, tag) {
  switch (tag.type) {
    case 1: wByte(w, tag.value); return;
    case 2: wShort(w, tag.value); return;
    case 3: wInt(w, tag.value); return;
    case 4: wLong(w, tag.value); return;
    case 5: wFloat(w, tag.value); return;
    case 6: wDouble(w, tag.value); return;
    case 7: wInt(w, tag.value.length); wRaw(w, tag.value); return;
    case 8: wString(w, tag.value); return;
    case 9:
      wUbyte(w, tag.value.length === 0 ? tag.itemType : tag.value[0].type);
      wInt(w, tag.value.length);
      for (var i = 0; i < tag.value.length; i++) writePayload(w, tag.value[i]);
      return;
    case 10: writeCompoundPayload(w, tag.value); return;
    case 11:
      wInt(w, tag.value.length);
      for (var j = 0; j < tag.value.length; j++) wInt(w, tag.value[j]);
      return;
    case 12:
      wInt(w, tag.value.length);
      for (var k = 0; k < tag.value.length; k++) wLong(w, tag.value[k]);
      return;
  }
}
function writeCompoundPayload(w, compound) {
  var keys = Object.keys(compound);
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var tag = compound[name];
    wUbyte(w, tag.type);
    wString(w, name);
    writePayload(w, tag);
  }
  wUbyte(w, 0);
}
function writeNamedRoot(root, name) {
  var w = makeWriter();
  wUbyte(w, 10);
  wString(w, name || '');
  writeCompoundPayload(w, root);
  return Buffer.concat(w.parts);
}

/* ---------------- Anvil region ---------------- */

function parseRegionFile(buf) {
  var chunks = new Map();
  if (buf.length < SECTOR_SIZE * 2) return { chunks: chunks };
  for (var i = 0; i < 1024; i++) {
    var offset = i * 4;
    var location = (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
    var size = buf[offset + 3];
    if (size === 0) continue;
    var timestamp = buf.readUInt32BE(SECTOR_SIZE + offset);
    var start = location * SECTOR_SIZE;
    var end = (location + size) * SECTOR_SIZE;
    if (start < SECTOR_SIZE * 2 || end > buf.length || end <= start) continue;
    chunks.set(i, { timestamp: timestamp, sectorData: buf.subarray(start, end) });
  }
  return { chunks: chunks };
}

function buildRegionFile(chunks) {
  var locations = Buffer.alloc(SECTOR_SIZE);
  var timestamps = Buffer.alloc(SECTOR_SIZE);
  var dataParts = [];
  var cursor = 2;
  var indices = Array.from(chunks.keys()).sort(function (a, b) { return a - b; });
  for (var n = 0; n < indices.length; n++) {
    var index = indices[n];
    var entry = chunks.get(index);
    if (!entry) continue;
    var sectorsNeeded = Math.ceil(entry.sectorData.length / SECTOR_SIZE);
    if (sectorsNeeded > 255) throw new Error('Chunk at local index ' + index + ' needs ' + sectorsNeeded + ' sectors, past the format\\'s 255-sector-per-chunk limit.');
    if (sectorsNeeded === 0) continue;
    var padLength = sectorsNeeded * SECTOR_SIZE - entry.sectorData.length;
    var padded = padLength === 0 ? entry.sectorData : Buffer.concat([entry.sectorData, Buffer.alloc(padLength)]);
    var offset = index * 4;
    locations[offset] = (cursor >>> 16) & 0xff;
    locations[offset + 1] = (cursor >>> 8) & 0xff;
    locations[offset + 2] = cursor & 0xff;
    locations[offset + 3] = sectorsNeeded & 0xff;
    timestamps.writeUInt32BE(entry.timestamp >>> 0, offset);
    dataParts.push(padded);
    cursor += sectorsNeeded;
  }
  return Buffer.concat([locations, timestamps].concat(dataParts));
}

function decodeChunkSector(sectorData) {
  if (sectorData.length < 5) throw new Error('A chunk sector is too short to hold a valid Anvil chunk header.');
  var length = sectorData.readUInt32BE(0);
  var compressionType = sectorData.readUInt8(4);
  var compressed = sectorData.subarray(5, 5 + Math.max(0, length - 1));
  if (compressionType === 2) return zlib.inflateSync(compressed);
  if (compressionType === 1) return zlib.gunzipSync(compressed);
  throw new Error('Chunk compression type ' + compressionType + ' is not gzip (1) or zlib (2); this chunk cannot be read.');
}
function encodeChunkSector(nbtBytes) {
  var compressed = zlib.deflateSync(nbtBytes);
  var header = Buffer.alloc(5);
  header.writeUInt32BE(compressed.length + 1, 0);
  header.writeUInt8(2, 4);
  return Buffer.concat([header, compressed]);
}

/* ---------------- coordinate rewriting ---------------- */

function isCompoundTag(t) { return !!t && t.type === 10; }
function isListTag(t) { return !!t && t.type === 9; }
function isIntTag(t) { return !!t && t.type === 3; }
function levelCompoundOf(root) { return isCompoundTag(root.Level) ? root.Level.value : root; }

function randomUuidInts() {
  var bytes = crypto.randomBytes(16);
  var out = new Int32Array(4);
  for (var i = 0; i < 4; i++) out[i] = bytes.readInt32BE(i * 4);
  return out;
}
function randomUuidLongs() {
  var bytes = crypto.randomBytes(16);
  return [bytes.readBigInt64BE(0), bytes.readBigInt64BE(8)];
}

function rewriteEntityCompound(comp, deltaBlockX, deltaBlockZ) {
  var moved = 0;
  var pos = comp.Pos;
  if (isListTag(pos) && pos.value.length >= 3) {
    var x = pos.value[0];
    var z = pos.value[2];
    if (x.type === 6) pos.value[0] = { type: 6, value: x.value + deltaBlockX };
    if (z.type === 6) pos.value[2] = { type: 6, value: z.value + deltaBlockZ };
    moved += 1;
  }
  if (comp.UUID && comp.UUID.type === 11 && comp.UUID.value.length === 4) {
    comp.UUID = { type: 11, value: randomUuidInts() };
  } else if (comp.UUIDMost && comp.UUIDMost.type === 4 && comp.UUIDLeast && comp.UUIDLeast.type === 4) {
    var pair = randomUuidLongs();
    comp.UUIDMost = { type: 4, value: pair[0] };
    comp.UUIDLeast = { type: 4, value: pair[1] };
  }
  var passengers = comp.Passengers;
  if (isListTag(passengers)) {
    for (var i = 0; i < passengers.value.length; i++) {
      if (isCompoundTag(passengers.value[i])) moved += rewriteEntityCompound(passengers.value[i].value, deltaBlockX, deltaBlockZ);
    }
  }
  return moved;
}

function rewriteChunkCoordinates(root, deltaChunkX, deltaChunkZ) {
  var level = levelCompoundOf(root);
  if (isIntTag(level.xPos)) level.xPos = { type: 3, value: level.xPos.value + deltaChunkX };
  if (isIntTag(level.zPos)) level.zPos = { type: 3, value: level.zPos.value + deltaChunkZ };
  var deltaBlockX = deltaChunkX * 16;
  var deltaBlockZ = deltaChunkZ * 16;
  var blockEntitiesMoved = 0;
  ['TileEntities', 'block_entities'].forEach(function (key) {
    var list = level[key];
    if (!isListTag(list)) return;
    for (var i = 0; i < list.value.length; i++) {
      var item = list.value[i];
      if (!isCompoundTag(item)) continue;
      var comp = item.value;
      if (isIntTag(comp.x)) { comp.x = { type: 3, value: comp.x.value + deltaBlockX }; blockEntitiesMoved += 1; }
      if (isIntTag(comp.z)) comp.z = { type: 3, value: comp.z.value + deltaBlockZ };
    }
  });
  var entitiesMoved = 0;
  var entities = level.Entities;
  if (isListTag(entities)) {
    for (var j = 0; j < entities.value.length; j++) {
      if (isCompoundTag(entities.value[j])) entitiesMoved += rewriteEntityCompound(entities.value[j].value, deltaBlockX, deltaBlockZ);
    }
  }
  return { blockEntitiesMoved: blockEntitiesMoved, entitiesMoved: entitiesMoved };
}

function rewriteEntitiesFileRoot(root, deltaChunkX, deltaChunkZ) {
  var position = root.Position;
  if (position && position.type === 11 && position.value.length >= 2) {
    var values = new Int32Array(position.value);
    values[0] += deltaChunkX;
    values[1] += deltaChunkZ;
    root.Position = { type: 11, value: values };
  }
  var entitiesMoved = 0;
  var entities = root.Entities;
  if (isListTag(entities)) {
    for (var i = 0; i < entities.value.length; i++) {
      if (isCompoundTag(entities.value[i])) entitiesMoved += rewriteEntityCompound(entities.value[i].value, deltaChunkX * 16, deltaChunkZ * 16);
    }
  }
  return entitiesMoved;
}

/* ---------------- atomic, verified write ---------------- */

function atomicWriteAndVerify(filePath, bytes, verify) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  var tmpPath = filePath + '.tmp-' + crypto.randomBytes(6).toString('hex');
  var fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  var reread;
  try {
    reread = fs.readFileSync(tmpPath);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch (e2) {}
    return { ok: false, error: 'The written file could not be read back: ' + describeError(e) };
  }
  var problem = verify(reread);
  if (problem) {
    try { fs.unlinkSync(tmpPath); } catch (e3) {}
    return { ok: false, error: 'The write did not verify, so nothing was changed: ' + problem };
  }
  fs.renameSync(tmpPath, filePath);
  return { ok: true };
}

function nowUnixSeconds() { return Math.floor(Date.now() / 1000); }

/* ---------------- high-level operations ---------------- */

function copyChunk(req) {
  var sameChunk = req.source.cx === req.destination.cx && req.source.cz === req.destination.cz && req.sourceRegionPath === req.destRegionPath;
  if (sameChunk) return { ok: false, error: 'The source and destination are the same chunk.', filesWritten: [], detail: '' };
  if (!fs.existsSync(req.sourceRegionPath)) return { ok: false, error: 'The source region file does not exist: ' + req.sourceRegionPath, filesWritten: [], detail: '' };

  var sourceBuf = fs.readFileSync(req.sourceRegionPath);
  var sourceParsed = parseRegionFile(sourceBuf);
  var sourceIndex = localIndex(mod32(req.source.cx), mod32(req.source.cz));
  var sourceEntry = sourceParsed.chunks.get(sourceIndex);
  if (!sourceEntry) return { ok: false, error: 'The source chunk (' + req.source.cx + ', ' + req.source.cz + ') has no data in ' + req.sourceRegionPath + '.', filesWritten: [], detail: '' };

  var deltaChunkX = req.destination.cx - req.source.cx;
  var deltaChunkZ = req.destination.cz - req.source.cz;

  var outSector, moved;
  try {
    var nbtBytes = decodeChunkSector(sourceEntry.sectorData);
    var parsed = readNamedRoot(nbtBytes);
    moved = rewriteChunkCoordinates(parsed.root, deltaChunkX, deltaChunkZ);
    outSector = encodeChunkSector(writeNamedRoot(parsed.root, ''));
  } catch (e) {
    return { ok: false, error: "Reading the source chunk's NBT failed: " + describeError(e), filesWritten: [], detail: '' };
  }

  var destIndex = localIndex(mod32(req.destination.cx), mod32(req.destination.cz));
  var sameRegionFile = req.destRegionPath === req.sourceRegionPath;
  var destParsed = sameRegionFile ? sourceParsed : parseRegionFile(fs.existsSync(req.destRegionPath) ? fs.readFileSync(req.destRegionPath) : Buffer.alloc(0));
  destParsed.chunks.set(destIndex, { timestamp: nowUnixSeconds(), sectorData: outSector });
  var destBytes = buildRegionFile(destParsed.chunks);

  var written = atomicWriteAndVerify(req.destRegionPath, destBytes, function (reread) {
    var entry;
    try { entry = parseRegionFile(reread).chunks.get(destIndex); } catch (e) { return 'the written region file could not be re-parsed: ' + describeError(e); }
    if (!entry) return 'the destination chunk is missing after the write';
    var decoded;
    try { decoded = decodeChunkSector(entry.sectorData); } catch (e) { return 'the written chunk could not be decompressed: ' + describeError(e); }
    var root;
    try { root = readNamedRoot(decoded).root; } catch (e) { return "the written chunk's NBT could not be parsed: " + describeError(e); }
    var level = levelCompoundOf(root);
    if (isIntTag(level.xPos) && level.xPos.value !== req.destination.cx) return 'xPos is ' + level.xPos.value + ', expected ' + req.destination.cx;
    if (isIntTag(level.zPos) && level.zPos.value !== req.destination.cz) return 'zPos is ' + level.zPos.value + ', expected ' + req.destination.cz;
    return null;
  });
  if (!written.ok) return { ok: false, error: written.error, filesWritten: [], detail: '' };

  var filesWritten = [req.destRegionPath];
  var entitiesNote = '';

  if (req.sourceEntitiesPath && req.destEntitiesPath && fs.existsSync(req.sourceEntitiesPath)) {
    var sourceEntBuf = fs.readFileSync(req.sourceEntitiesPath);
    var sourceEntParsed = parseRegionFile(sourceEntBuf);
    var entEntry = sourceEntParsed.chunks.get(sourceIndex);
    if (entEntry) {
      var entOutSector;
      try {
        var entNbt = decodeChunkSector(entEntry.sectorData);
        var entParsed = readNamedRoot(entNbt);
        rewriteEntitiesFileRoot(entParsed.root, deltaChunkX, deltaChunkZ);
        entOutSector = encodeChunkSector(writeNamedRoot(entParsed.root, ''));
      } catch (e) {
        return { ok: false, error: 'Reading the source entity data failed: ' + describeError(e), filesWritten: filesWritten, detail: '' };
      }
      var sameEntitiesFile = req.destEntitiesPath === req.sourceEntitiesPath;
      var destEntParsed = sameEntitiesFile ? sourceEntParsed : parseRegionFile(fs.existsSync(req.destEntitiesPath) ? fs.readFileSync(req.destEntitiesPath) : Buffer.alloc(0));
      destEntParsed.chunks.set(destIndex, { timestamp: nowUnixSeconds(), sectorData: entOutSector });
      var destEntBytes = buildRegionFile(destEntParsed.chunks);
      var entWritten = atomicWriteAndVerify(req.destEntitiesPath, destEntBytes, function (reread) {
        var entries;
        try { entries = parseRegionFile(reread).chunks; } catch (e) { return 'the written entities file could not be re-parsed: ' + describeError(e); }
        return entries.has(destIndex) ? null : 'the destination entity data is missing after the write';
      });
      if (!entWritten.ok) return { ok: false, error: entWritten.error, filesWritten: filesWritten, detail: '' };
      filesWritten.push(req.destEntitiesPath);
      entitiesNote = ' and its separate entity data';
    }
  }

  return {
    ok: true,
    error: null,
    filesWritten: filesWritten,
    detail: 'Copied chunk (' + req.source.cx + ', ' + req.source.cz + ') to (' + req.destination.cx + ', ' + req.destination.cz + '): ' + moved.blockEntitiesMoved + ' block entities and ' + moved.entitiesMoved + ' entities repositioned' + entitiesNote + '.'
  };
}

function removeChunks(req) {
  if (!fs.existsSync(req.regionPath)) return { ok: false, error: 'The region file does not exist: ' + req.regionPath, filesWritten: [], detail: '' };
  if (!req.chunks || req.chunks.length === 0) return { ok: false, error: 'No chunks were given to remove.', filesWritten: [], detail: '' };

  var buf = fs.readFileSync(req.regionPath);
  var parsed = parseRegionFile(buf);
  var indices = req.chunks.map(function (pos) { return localIndex(mod32(pos.cx), mod32(pos.cz)); });
  var removed = 0;
  for (var i = 0; i < indices.length; i++) {
    if (parsed.chunks.delete(indices[i])) removed += 1;
  }
  if (removed === 0) return { ok: false, error: 'None of the selected chunks have any data to remove.', filesWritten: [], detail: '' };

  var outBytes = buildRegionFile(parsed.chunks);
  var written = atomicWriteAndVerify(req.regionPath, outBytes, function (reread) {
    var entries;
    try { entries = parseRegionFile(reread).chunks; } catch (e) { return 'the written region file could not be re-parsed: ' + describeError(e); }
    for (var j = 0; j < indices.length; j++) {
      if (entries.has(indices[j])) return 'chunk local index ' + indices[j] + ' is still present after removal';
    }
    return null;
  });
  if (!written.ok) return { ok: false, error: written.error, filesWritten: [], detail: '' };

  var filesWritten = [req.regionPath];

  if (req.entitiesPath && fs.existsSync(req.entitiesPath)) {
    var entBuf = fs.readFileSync(req.entitiesPath);
    var entParsed = parseRegionFile(entBuf);
    var entRemoved = 0;
    for (var k = 0; k < indices.length; k++) {
      if (entParsed.chunks.delete(indices[k])) entRemoved += 1;
    }
    if (entRemoved > 0) {
      var entOut = buildRegionFile(entParsed.chunks);
      var entWritten = atomicWriteAndVerify(req.entitiesPath, entOut, function (reread) {
        var entries2;
        try { entries2 = parseRegionFile(reread).chunks; } catch (e) { return 'the written entities file could not be re-parsed: ' + describeError(e); }
        for (var m = 0; m < indices.length; m++) {
          if (entries2.has(indices[m])) return 'entity local index ' + indices[m] + ' is still present after removal';
        }
        return null;
      });
      if (!entWritten.ok) return { ok: false, error: entWritten.error, filesWritten: filesWritten, detail: '' };
      filesWritten.push(req.entitiesPath);
    }
  }

  return { ok: true, error: null, filesWritten: filesWritten, detail: 'Removed ' + removed + ' chunk(s) from ' + req.regionPath + '.' };
}

/* ---------------- CLI entry ---------------- */

function main() {
  var operationPath = process.argv[2];
  if (!operationPath) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'Usage: node region-worker.cjs <operation.json>', filesWritten: [], detail: '' }) + '\\n');
    process.exit(1);
  }
  var operation;
  try {
    operation = JSON.parse(fs.readFileSync(operationPath, 'utf8'));
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: describeError(e), filesWritten: [], detail: '' }) + '\\n');
    process.exit(1);
    return;
  }
  var result;
  try {
    if (operation.kind === 'copy') result = copyChunk(operation.copy);
    else if (operation.kind === 'remove') result = removeChunks(operation.remove);
    else result = { ok: false, error: 'Unknown operation kind: ' + operation.kind, filesWritten: [], detail: '' };
  } catch (e) {
    result = { ok: false, error: describeError(e), filesWritten: [], detail: '' };
  }
  process.stdout.write(JSON.stringify(result) + '\\n');
  process.exit(result.ok ? 0 : 1);
}

main();
`;
