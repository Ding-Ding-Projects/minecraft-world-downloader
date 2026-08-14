/**
 * Integration coverage for `main/services/vault.ts` -- OS-encrypted credential
 * storage (Electron `safeStorage` + an atomic file write).
 *
 * This is the one service in the project where a real regression would be the
 * most damaging kind: a credential silently not saved, silently corrupted, or
 * -- worst of all -- silently written to disk in the clear. Its filesystem
 * calls (load/persist, including the temp-file-then-rename atomic write) have
 * never run under test before this file. Every test below drives the real
 * exported functions against a real temporary directory on a real filesystem;
 * nothing about `fs` is stubbed.
 *
 * `safeStorage` genuinely needs a running Electron process, which this test
 * run does not have. It is injected at exactly that one seam -- alongside
 * `app.getPath`, which `../paths.ts` also needs -- via `vi.mock('electron',
 * ...)`. The stand-in `safeStorage.encryptString`/`decryptString` is a
 * reversible byte transform (XOR with a fixed key), deliberately NOT a no-op:
 * it exists so a test can prove ciphertext-on-disk is not the plaintext
 * itself, and so a genuinely wrong encoding (tested below) produces
 * genuinely wrong plaintext on read-back, the same way a real DPAPI/Keychain
 * mismatch would. Every other seam -- account validation, the in-memory
 * cache, the JSON document shape, the temp-file-then-rename write, corruption
 * handling -- is the module's own real code, verified independently by
 * re-reading the raw file this file's own `fs` calls, never the module's
 * word for its own success.
 *
 * A real credential is never written here: every secret value used below is
 * an obviously-fake fixture string, and every assertion that checks "nothing
 * leaked" checks for that exact fixture string, never a real one.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

const state = vi.hoisted(() => ({ appDataRoot: '', encryptionAvailable: true }));

vi.mock('electron', () => {
  // A deliberately non-trivial reversible transform -- not the module's real
  // encryption, but not a no-op passthrough either. See the file header for
  // why this exact stand-in is the right one to inject.
  const XOR_KEY = 0x5a;
  function xorBuffer(buf: Buffer): Buffer {
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i += 1) out[i] = buf[i] ^ XOR_KEY;
    return out;
  }
  return {
    app: {
      getPath: (_name: string) => state.appDataRoot,
      setPath: () => undefined
    },
    safeStorage: {
      isEncryptionAvailable: () => state.encryptionAvailable,
      encryptString: (secret: string) => xorBuffer(Buffer.from(secret, 'utf8')),
      decryptString: (buf: Buffer) => xorBuffer(Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString('utf8'),
      getSelectedStorageBackend: () => 'test-backend'
    }
  };
});

/** Independent re-implementation of the injected transform, used ONLY by the
 * tests themselves to verify the on-disk ciphertext through a second,
 * separate channel from the module under test -- never importing the
 * module's own decrypt path to check the module's own write.
 */
function independentDecryptBase64(base64: string): string {
  const XOR_KEY = 0x5a;
  const buf = Buffer.from(base64, 'base64');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i += 1) out[i] = buf[i] ^ XOR_KEY;
  return out.toString('utf8');
}

type VaultModule = typeof import('../../src/main/services/vault');

const tmpDirs: string[] = [];
function freshTmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

async function freshVaultModule(): Promise<VaultModule> {
  vi.resetModules();
  state.appDataRoot = freshTmpDir('wds-vault-appdata-');
  state.encryptionAvailable = true;
  return import('../../src/main/services/vault');
}

/** Reloads the module fresh (a new in-memory cache) while pointing at the
 * SAME app-data directory -- standing in for the next real app launch
 * against the same disk, as opposed to `freshVaultModule()`'s brand-new
 * temp directory used for test isolation between unrelated tests.
 */
async function reloadVaultModuleSameDisk(): Promise<VaultModule> {
  vi.resetModules();
  return import('../../src/main/services/vault');
}

function vaultFilePathFor(appDataRoot: string): string {
  return join(appDataRoot, 'world-downloader-studio', 'vault.bin');
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Best-effort cleanup; a lingering handle is not worth failing the suite.
    }
  }
});

/* ==================================================================== */
/* status() on a fresh vault                                             */
/* ==================================================================== */

describe('status(): a fresh vault, before anything is ever written', () => {
  it('reports zero entries and never creates the vault file merely by being asked', async () => {
    const vault = await freshVaultModule();
    const s = await vault.status();

    expect(s.encryptionAvailable).toBe(true);
    expect(s.entryCount).toBe(0);
    expect(typeof s.backend).toBe('string');
    expect(s.backend.length).toBeGreaterThan(0);
    expect(existsSync(vaultFilePathFor(state.appDataRoot))).toBe(false);
  });
});

/* ==================================================================== */
/* write-then-read round trip, verified through an independent decoder   */
/* ==================================================================== */

describe('setSecret()/getSecret(): a real write-then-read round trip', () => {
  it('stores and returns the exact secret, and the on-disk ciphertext is neither the plaintext nor decodable without the transform', async () => {
    const vault = await freshVaultModule();
    const account = 'mc:premium-fixture-account';
    const secret = 'TEST-FIXTURE-SECRET-blueberry-72-not-a-real-credential';

    await vault.setSecret(account, secret);
    const readBack = await vault.getSecret(account);
    expect(readBack).toBe(secret);
    expect(await vault.hasSecret(account)).toBe(true);

    // Independent channel: read the raw file this module wrote, completely
    // outside the module's own load()/getSecret() path.
    const raw = readFileSync(vaultFilePathFor(state.appDataRoot), 'utf8');
    expect(raw).not.toContain(secret); // never written in the clear
    const doc = JSON.parse(raw) as { schemaVersion: number; entries: Record<string, string> };
    expect(doc.schemaVersion).toBe(1);
    const ciphertextBase64 = doc.entries[account];
    expect(typeof ciphertextBase64).toBe('string');
    expect(ciphertextBase64).not.toContain(secret);

    // And a second, independently-implemented decoder (not the module's own
    // decryptString) proves the ciphertext really does decode back to the
    // secret -- this is not just "some string is stored", it is genuinely
    // the encrypted form of exactly this secret.
    expect(independentDecryptBase64(ciphertextBase64)).toBe(secret);
  });

  it('overwriting an account replaces its value without touching a sibling account', async () => {
    const vault = await freshVaultModule();
    await vault.setSecret('account-one', 'TEST-FIXTURE-first-value');
    await vault.setSecret('account-two', 'TEST-FIXTURE-untouched-value');

    await vault.setSecret('account-one', 'TEST-FIXTURE-second-value');

    expect(await vault.getSecret('account-one')).toBe('TEST-FIXTURE-second-value');
    expect(await vault.getSecret('account-two')).toBe('TEST-FIXTURE-untouched-value');

    const doc = JSON.parse(readFileSync(vaultFilePathFor(state.appDataRoot), 'utf8')) as { entries: Record<string, string> };
    expect(Object.keys(doc.entries).sort()).toEqual(['account-one', 'account-two']);
  });
});

/* ==================================================================== */
/* deleteSecret()                                                        */
/* ==================================================================== */

describe('deleteSecret(): removal is real and leaves everything else intact', () => {
  it('removes exactly the targeted account from disk, verified by an independent read', async () => {
    const vault = await freshVaultModule();
    await vault.setSecret('to-delete', 'TEST-FIXTURE-goes-away');
    await vault.setSecret('to-keep', 'TEST-FIXTURE-stays');

    await vault.deleteSecret('to-delete');

    expect(await vault.getSecret('to-delete')).toBeNull();
    expect(await vault.hasSecret('to-delete')).toBe(false);
    expect(await vault.listAccounts()).toEqual(['to-keep']);

    const doc = JSON.parse(readFileSync(vaultFilePathFor(state.appDataRoot), 'utf8')) as { entries: Record<string, string> };
    expect('to-delete' in doc.entries).toBe(false);
    expect(doc.entries['to-keep']).toBeDefined();
  });

  it('deleting an account that was never stored is a real no-op: no file is ever created', async () => {
    const vault = await freshVaultModule();
    await expect(vault.deleteSecret('never-existed')).resolves.toBeUndefined();
    expect(existsSync(vaultFilePathFor(state.appDataRoot))).toBe(false);
  });
});

/* ==================================================================== */
/* Corrupt file on disk                                                  */
/* ==================================================================== */

describe('load(): a corrupt vault file on disk is never destroyed by a failed read', () => {
  it('treats an unparsable file as an empty vault without throwing, and leaves the corrupt bytes untouched until the next real write', async () => {
    const vault = await freshVaultModule();
    const path = vaultFilePathFor(state.appDataRoot);
    mkdirSync(join(state.appDataRoot, 'world-downloader-studio'), { recursive: true });
    const garbage = 'this is not JSON at all -- {{{ broken vault file %%%';
    writeFileSync(path, garbage, 'utf8');

    const s = await vault.status();
    expect(s.entryCount).toBe(0);
    expect(s.encryptionAvailable).toBe(true);

    // Independent read: status()/load() did not rewrite or delete the
    // corrupt file merely by failing to parse it.
    expect(readFileSync(path, 'utf8')).toBe(garbage);

    // A real write afterward succeeds and produces a valid document, exactly
    // as it would for a first-time user -- the corruption is not fatal.
    await vault.setSecret('after-corruption', 'TEST-FIXTURE-recovered');
    expect(await vault.getSecret('after-corruption')).toBe('TEST-FIXTURE-recovered');
    const doc = JSON.parse(readFileSync(path, 'utf8')) as { entries: Record<string, string> };
    expect(Object.keys(doc.entries)).toEqual(['after-corruption']);
  });
});

/* ==================================================================== */
/* Atomic write: a real interrupted write must not destroy the prior     */
/* value -- proven with a genuine filesystem failure, no fs mocking      */
/* ==================================================================== */

describe('persist(): the atomic write really protects the previous value on a genuine failure', () => {
  it('when the rename-target write step genuinely fails, the durable on-disk vault content is completely unharmed', async () => {
    const vault = await freshVaultModule();
    await vault.setSecret('stable-account', 'TEST-FIXTURE-must-survive-the-failure');
    const path = vaultFilePathFor(state.appDataRoot);
    const before = readFileSync(path, 'utf8');

    // Force a REAL fs.writeFile failure at the exact temp-file step the
    // module uses for its atomic write, without mocking fs at all: the
    // module writes to `${path}.tmp-${process.pid}` before renaming it over
    // the real file. Pre-creating a directory at that exact path makes the
    // write genuinely fail (EISDIR/EPERM), which is exactly the kind of real
    // interruption an atomic-write scheme exists to survive.
    const collisionDir = `${path}.tmp-${process.pid}`;
    mkdirSync(collisionDir, { recursive: true });
    try {
      await expect(vault.setSecret('stable-account', 'TEST-FIXTURE-should-never-land-on-disk')).rejects.toThrow();
    } finally {
      rmSync(collisionDir, { recursive: true, force: true });
    }

    // The durable file on disk was never touched by the failed write: no
    // half-written bytes, no truncation, no silently-adopted new value. This
    // is the property persist()'s write-then-rename scheme actually protects.
    expect(readFileSync(path, 'utf8')).toBe(before);

    // A fresh module instance -- standing in for the next real app launch,
    // which starts with no in-memory cache -- reads back exactly the
    // durable, pre-failure value from disk, proving the failure never
    // reached the file a restart would actually load.
    const reloaded = await reloadVaultModuleSameDisk();
    expect(await reloaded.getSecret('stable-account')).toBe('TEST-FIXTURE-must-survive-the-failure');
  });

  it('a failed write leaves the in-process cache holding the ORIGINAL value, so this process never reports a secret that is not on disk', async () => {
    const vault = await freshVaultModule();
    await vault.setSecret('stable-account-2', 'TEST-FIXTURE-original-value');
    const path = vaultFilePathFor(state.appDataRoot);

    const collisionDir = `${path}.tmp-${process.pid}`;
    mkdirSync(collisionDir, { recursive: true });
    try {
      await expect(vault.setSecret('stable-account-2', 'TEST-FIXTURE-unpersisted-value')).rejects.toThrow();
    } finally {
      rmSync(collisionDir, { recursive: true, force: true });
    }

    // The write genuinely failed, and the durable disk copy genuinely still
    // holds the original value (independently decoded, not read through the
    // module's own getSecret()).
    const onDisk = JSON.parse(readFileSync(path, 'utf8')) as { entries: Record<string, string> };
    expect(independentDecryptBase64(onDisk.entries['stable-account-2'])).toBe('TEST-FIXTURE-original-value');

    // And the running process agrees with the disk. setSecret() applies its
    // change to a COPY and hands that to persist(), which adopts it into the
    // cache only after the atomic rename succeeds -- so a failed write leaves
    // the cache exactly as it was. Without that, this same process would keep
    // serving a secret that was never saved: correct for the rest of the
    // session, gone at the next launch, and never once reported as a failure
    // the user could act on. Memory and disk must not be allowed to disagree
    // about whether a credential exists.
    expect(await vault.getSecret('stable-account-2')).toBe('TEST-FIXTURE-original-value');

    // The next real app launch, which starts with no cache at all, sees the
    // same thing -- so the two paths cannot drift apart.
    const reloaded = await reloadVaultModuleSameDisk();
    expect(await reloaded.getSecret('stable-account-2')).toBe('TEST-FIXTURE-original-value');
  });

  it('a failed delete does not report the credential as gone while it is still on disk', async () => {
    const vault = await freshVaultModule();
    await vault.setSecret('doomed-account', 'TEST-FIXTURE-still-there');
    const path = vaultFilePathFor(state.appDataRoot);

    // Same genuine filesystem failure, applied to the delete path. This is the
    // worse direction of the two: a deletion the user asked for, reported as
    // done, that never reached the disk -- so the credential they believe they
    // removed is still stored and returns at the next launch.
    const collisionDir = `${path}.tmp-${process.pid}`;
    mkdirSync(collisionDir, { recursive: true });
    try {
      await expect(vault.deleteSecret('doomed-account')).rejects.toThrow();
    } finally {
      rmSync(collisionDir, { recursive: true, force: true });
    }

    // Read independently rather than through the module: the credential is
    // genuinely still on disk, so the module must not claim otherwise.
    const onDisk = JSON.parse(readFileSync(path, 'utf8')) as { entries: Record<string, string> };
    expect(independentDecryptBase64(onDisk.entries['doomed-account'])).toBe('TEST-FIXTURE-still-there');

    expect(await vault.hasSecret('doomed-account')).toBe(true);
    expect(await vault.getSecret('doomed-account')).toBe('TEST-FIXTURE-still-there');

    const reloaded = await reloadVaultModuleSameDisk();
    expect(await reloaded.getSecret('doomed-account')).toBe('TEST-FIXTURE-still-there');
  });
});

/* ==================================================================== */
/* Encryption unavailable                                                */
/* ==================================================================== */

describe('encryption unavailable: refuses to write in the clear, and the boundary between read paths is exact', () => {
  it('setSecret() throws and writes nothing when the OS encryption service is unavailable', async () => {
    const vault = await freshVaultModule();
    state.encryptionAvailable = false;

    let thrown: unknown;
    try {
      await vault.setSecret('blocked-account', 'TEST-FIXTURE-should-never-be-written');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/encryption service is unavailable/i);
    expect((thrown as Error).message).not.toContain('TEST-FIXTURE-should-never-be-written');
    expect(existsSync(vaultFilePathFor(state.appDataRoot))).toBe(false);
  });

  it('getSecret() on a genuinely stored account throws when encryption becomes unavailable, but a never-stored account still returns null without throwing', async () => {
    const vault = await freshVaultModule();
    await vault.setSecret('has-a-secret', 'TEST-FIXTURE-stored-while-available');
    state.encryptionAvailable = false;

    let thrown: unknown;
    try {
      await vault.getSecret('has-a-secret');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/cannot be read/i);
    expect((thrown as Error).message).not.toContain('TEST-FIXTURE-stored-while-available');

    // The "does this account even exist" question never needs decryption,
    // so it must not throw just because encryption later became unavailable.
    await expect(vault.getSecret('account-that-was-never-stored')).resolves.toBeNull();
  });
});

/* ==================================================================== */
/* Account key validation                                                */
/* ==================================================================== */

describe('assertAccount(): real input validation at the real public API', () => {
  it('rejects an empty account, an over-long account, and one with disallowed characters', async () => {
    const vault = await freshVaultModule();
    await expect(vault.setSecret('', 'TEST-FIXTURE-x')).rejects.toThrow(/non-empty/);
    await expect(vault.setSecret('a'.repeat(201), 'TEST-FIXTURE-x')).rejects.toThrow(/200 characters/);
    await expect(vault.setSecret('bad account name!', 'TEST-FIXTURE-x')).rejects.toThrow(/may only contain/);

    // None of these malformed attempts left anything on disk.
    expect(existsSync(vaultFilePathFor(state.appDataRoot))).toBe(false);
  });

  it('accepts the documented allowed character set', async () => {
    const vault = await freshVaultModule();
    const account = 'mc.premium:eu-west_1@studio-01';
    await vault.setSecret(account, 'TEST-FIXTURE-allowed-chars');
    expect(await vault.getSecret(account)).toBe('TEST-FIXTURE-allowed-chars');
  });
});

/* ==================================================================== */
/* listAccounts(): keys only, sorted, never values                       */
/* ==================================================================== */

describe('listAccounts(): sorted account names only, never a value', () => {
  it('returns every stored account name sorted, and never a secret value alongside it', async () => {
    const vault = await freshVaultModule();
    await vault.setSecret('zeta', 'TEST-FIXTURE-zeta-value');
    await vault.setSecret('alpha', 'TEST-FIXTURE-alpha-value');
    await vault.setSecret('mu', 'TEST-FIXTURE-mu-value');

    const accounts = await vault.listAccounts();
    expect(accounts).toEqual(['alpha', 'mu', 'zeta']);
    for (const name of accounts) {
      expect(name).not.toMatch(/TEST-FIXTURE/);
    }
  });
});
