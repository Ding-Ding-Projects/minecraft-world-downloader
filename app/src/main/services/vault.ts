import { safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { VaultStatus } from '../../shared/api';
import { vaultFilePath } from '../paths';

/**
 * Credential storage backed by the operating system's own encryption service
 * (DPAPI on Windows, Keychain on macOS, libsecret/kwallet on Linux) through
 * Electron's `safeStorage`. No third-party native module and no key of our own.
 *
 * The ciphertext lives in one file inside the application data directory. Nothing
 * here ever writes a secret to a log, a settings file, an export, the history
 * repository or the renderer's console, and `listAccounts` returns keys only —
 * never a value, never a length, never a hash.
 */

interface VaultDocument {
  schemaVersion: number;
  /** account -> base64 of the encrypted secret. */
  entries: Record<string, string>;
}

const SCHEMA_VERSION = 1;

let cache: VaultDocument | null = null;

function empty(): VaultDocument {
  return { schemaVersion: SCHEMA_VERSION, entries: {} };
}

async function load(): Promise<VaultDocument> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(vaultFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<VaultDocument>;
    cache = {
      schemaVersion: SCHEMA_VERSION,
      entries:
        typeof parsed.entries === 'object' && parsed.entries !== null
          ? (parsed.entries as Record<string, string>)
          : {}
    };
  } catch {
    cache = empty();
  }
  return cache;
}

async function persist(document: VaultDocument): Promise<void> {
  const path = vaultFilePath();
  await fs.mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await fs.writeFile(temporary, JSON.stringify(document), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, path);
  cache = document;
}

function backendName(): string {
  if (process.platform === 'win32') return 'dpapi';
  if (process.platform === 'darwin') return 'keychain';
  try {
    return safeStorage.getSelectedStorageBackend();
  } catch {
    return 'unknown';
  }
}

export async function status(): Promise<VaultStatus> {
  const document = await load();
  return {
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    backend: backendName(),
    entryCount: Object.keys(document.entries).length
  };
}

export async function setSecret(account: string, secret: string): Promise<void> {
  assertAccount(account);
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'The operating system encryption service is unavailable, so no credential was stored. Nothing was written in the clear.'
    );
  }
  const document = await load();
  // Build the change on a copy rather than on the cached document itself.
  // `load()` hands back the live cache object, so mutating it here would apply
  // the change in memory before the write that is supposed to make it real —
  // and a failed write would then leave this process serving a credential that
  // is not on disk. It would read back correctly for the rest of the session
  // and be gone at the next launch, which is the worst shape a storage failure
  // can take. persist() commits the new document to the cache only after the
  // atomic rename succeeds, so passing it a copy is what makes that commit
  // point mean something.
  const next: VaultDocument = {
    ...document,
    entries: { ...document.entries, [account]: safeStorage.encryptString(secret).toString('base64') }
  };
  await persist(next);
}

export async function getSecret(account: string): Promise<string | null> {
  assertAccount(account);
  const document = await load();
  const stored = document.entries[account];
  if (typeof stored !== 'string') return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('The operating system encryption service is unavailable, so the stored credential cannot be read.');
  }
  return safeStorage.decryptString(Buffer.from(stored, 'base64'));
}

export async function hasSecret(account: string): Promise<boolean> {
  assertAccount(account);
  const document = await load();
  return typeof document.entries[account] === 'string';
}

export async function deleteSecret(account: string): Promise<void> {
  assertAccount(account);
  const document = await load();
  if (account in document.entries) {
    // Same copy-then-persist rule as setSecret, and the consequence of getting
    // it wrong is worse here: mutating the cache first would report a deletion
    // that never reached disk, so the credential the user asked to remove is
    // still there and returns at the next launch.
    const entries = { ...document.entries };
    delete entries[account];
    await persist({ ...document, entries });
  }
}

export async function listAccounts(): Promise<string[]> {
  const document = await load();
  return Object.keys(document.entries).sort();
}

function assertAccount(account: string): void {
  if (typeof account !== 'string' || account.length === 0 || account.length > 200) {
    throw new Error('A vault account key must be a non-empty string of at most 200 characters.');
  }
  if (!/^[A-Za-z0-9._:@-]+$/.test(account)) {
    throw new Error('A vault account key may only contain letters, digits and the characters . _ : @ -');
  }
}
