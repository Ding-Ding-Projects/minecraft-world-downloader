/**
 * Every settings key this feature owns.
 *
 * Setting ids are unique across the whole application and are never renamed
 * once shipped: a renamed id is a silently reset preference, which reads to the
 * user as the application forgetting what they chose.
 */
export const DOWNLOAD_SETTINGS = {
  /** Absolute folder new downloads are written into. */
  folder: 'downloads.folder',
  /** Start the loopback receiver automatically when the application starts. */
  autoStartReceiver: 'downloads.receiver.autoStart',
  /** The loopback port the receiver binds. */
  port: 'downloads.receiver.port',
  /** Ask before every capture, or start matching captures straight away. */
  askBeforeStarting: 'downloads.askBeforeStarting',
  /** How many transfers may move bytes at the same time. */
  maxConcurrent: 'downloads.maxConcurrent',
  /** Keep the application above the browser while a decision is pending. */
  alwaysOnTop: 'downloads.alwaysOnTop',
  /** Open the separate progress surface for each transfer as it starts. */
  openProgressWindow: 'downloads.openProgressWindow',
  /** Show the completion surface when a transfer finishes. */
  showCompletion: 'downloads.showCompletion',
  /** Overwrite an existing file rather than writing a numbered variant. */
  overwrite: 'downloads.overwrite',
  /** Reveal the finished file in the platform file manager automatically. */
  revealOnCompletion: 'downloads.revealOnCompletion',
  /** Persisted list of download records, so the list survives a restart. */
  records: 'downloads.records',
  /** The action that starts or restarts the receiver from settings. */
  restartReceiver: 'downloads.receiver.restart',
  /** The action that opens the pairing details for the browser extension. */
  showPairing: 'downloads.receiver.pairing'
} as const;

export const DEFAULT_PORT = 43110;
export const DEFAULT_MAX_CONCURRENT = 3;
