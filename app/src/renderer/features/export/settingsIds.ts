/**
 * Setting ids, in one place.
 *
 * The panel reads them and the settings section declares them, so a rename can
 * never leave one half of the feature writing a key the other half never reads.
 * These ids are stable: they are what is on disk in the user's settings file.
 */
export const EXPORT_SETTINGS = {
  defaultFormat: 'export.defaultFormat',
  lineEnding: 'export.lineEndings',
  byteOrderMark: 'export.byteOrderMark',
  destination: 'export.destination',
  openInEditor: 'export.openInEditor',
  editorId: 'export.editorId',
  archiveFormat: 'export.archive.format',
  archiveMethod: 'export.archive.method',
  archiveLevel: 'export.archive.level',
  archiveDictionary: 'export.archive.dictionary',
  archiveWordSize: 'export.archive.wordSize',
  archiveSolid: 'export.archive.solid',
  archiveSolidBlock: 'export.archive.solidBlock',
  archiveThreads: 'export.archive.threads',
  archiveVolume: 'export.archive.volume',
  archiveEncryptHeaders: 'export.archive.encryptHeaders',
  archiverCommand: 'export.archive.command',
  archiveName: 'export.archive.name'
} as const;

export const EXPORT_TAB_ID = 'export.main';
