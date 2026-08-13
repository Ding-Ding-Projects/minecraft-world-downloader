/**
 * Every stable identifier this feature owns.
 *
 * Setting ids are unique across the whole application and are never renamed
 * once shipped: a rename silently orphans whatever the user had stored, and the
 * provenance line would then report a compiled-in default for a value the user
 * genuinely chose.
 */

export const CONSOLE_TAB_ID = 'console.main';

export const CONSOLE_SETTINGS = {
  /** Folder holding the console's `app.py`, `auth.py` and `requirements.txt`. */
  serviceDirectory: 'console.serviceDirectory',
  /** The console's `DATA_DIR`: worlds, saved configuration, exports, caches. */
  dataDirectory: 'console.dataDirectory',
  /** Which Python launcher starts it. Only bare names the bridge permits. */
  pythonCommand: 'console.pythonCommand',
  /** Loopback port the console listens on. The host is always loopback. */
  port: 'console.port',
  /** Path of the jar the console hands to the downloader, passed as JAR_PATH. */
  jarPath: 'console.jarPath',
  /** Poll the health endpoint on a timer rather than only on demand. */
  autoProbe: 'console.autoProbe',
  /** Seconds between health probes while the surface is open. */
  probeSeconds: 'console.probeSeconds',
  /** Seconds between log fetches while the surface is open. */
  logSeconds: 'console.logSeconds',
  /** How many log lines the surface retains before dropping the oldest. */
  logRetention: 'console.logRetention',
  /** Follow the log to its newest line as it arrives. */
  logFollow: 'console.logFollow',
  /** How deep the world scan descends below the data directory. */
  scanDepth: 'console.scanDepth',
  /** Hard ceiling on files visited by one world measurement. */
  scanCap: 'console.scanCap',
  /** Username used when this application starts a login-protected console. */
  consoleUsername: 'console.consoleUsername',
  /** Start the console with its own username and password gate enabled. */
  requireLogin: 'console.requireLogin',
  /** The vault entry holding that password. Rendered as set/replace/forget. */
  storedPassword: 'console.storedPassword',
  /** Re-check the world list whenever the surface regains focus. */
  rescanOnFocus: 'console.rescanOnFocus'
} as const;

/**
 * Vault account key for the console's own login password.
 *
 * The value lives only in the operating system credential vault. It is read
 * exactly once, inside the user-initiated action that starts the service, and
 * is handed straight to the child process environment: it is never written to
 * settings, an export, a log line, a history entry or the screen.
 */
export const CONSOLE_PASSWORD_ACCOUNT = 'console.web-password';

/** Element ids the palette teleports to. */
export const CONSOLE_ANCHORS = {
  service: 'console-service',
  worlds: 'console-worlds',
  configuration: 'console-configuration',
  account: 'console-account',
  logs: 'console-logs',
  records: 'console-records'
} as const;
