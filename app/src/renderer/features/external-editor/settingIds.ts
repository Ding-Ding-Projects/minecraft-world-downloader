/**
 * Every stable identifier this feature owns.
 *
 * They are collected here because a setting id is a permanent public name: it
 * appears in the settings file on disk, in exported settings documents, in the
 * command palette's registration and in local history payloads. Renaming one
 * silently orphans whatever a user already stored under the old name, so the
 * ids live in one file where the cost of changing one is obvious.
 */

/** The tab this feature registers. */
export const TAB_ID = 'external-editor.main';

/** Which editor a handoff uses. `auto` prefers Visual Studio Code. */
export const ACTIVE_ID = 'external-editor.active';

/** How a file handoff opens: the file alone, or its folder as a workspace root. */
export const FILE_MODE_ID = 'external-editor.fileMode';

/** Probe the machine for editors when the application starts. */
export const PROBE_AT_START_ID = 'external-editor.probeAtStart';

/** The folder the "open the project folder" command hands over. */
export const PROJECT_FOLDER_ID = 'external-editor.projectFolder';

/** How many recent handoffs are kept. */
export const RECENT_LIMIT_ID = 'external-editor.recentLimit';

/** Editors the user added by browsing for an executable. Not a visible control. */
export const CUSTOM_EDITORS_KEY = 'external-editor.customEditors';

/** The recent-handoff log. Not a visible control. */
export const RECENT_KEY = 'external-editor.recent';

/** The value of ACTIVE_ID that means "choose the best available automatically". */
export const AUTOMATIC = 'auto';

/** `file` opens the file itself; `workspace` opens its folder as a workspace root. */
export type FileMode = 'file' | 'workspace';

export const DEFAULT_ACTIVE = AUTOMATIC;
export const DEFAULT_FILE_MODE: FileMode = 'file';
export const DEFAULT_PROBE_AT_START = true;
export const DEFAULT_PROJECT_FOLDER = '';
export const DEFAULT_RECENT_LIMIT = 20;

/** Where Visual Studio Code is downloaded from. Opened in the user's browser. */
export const VS_CODE_DOWNLOAD_URL = 'https://code.visualstudio.com/download';

/** Element ids the palette teleports to. */
export const ELEMENT_IDS = {
  status: 'external-editor-status',
  list: 'external-editor-list',
  add: 'external-editor-add',
  open: 'external-editor-open',
  recent: 'external-editor-recent'
} as const;
