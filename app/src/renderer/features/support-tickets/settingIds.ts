/**
 * Setting ids owned by this feature.
 *
 * They live in their own module so the form, the list, the settings section and
 * the palette all read the same constant rather than three copies of a string
 * that can drift apart. A setting id is stable and is never renamed: renaming
 * one orphans whatever the user had already stored under it.
 */

/** The destination this feature registers. Read by the desk and the palette. */
export const TAB_ID = 'supportTickets.desk';

export const DEFAULT_SEVERITY_ID = 'supportTickets.defaultSeverity';
export const PAGE_SIZE_ID = 'supportTickets.pageSize';
export const ADOPT_UNLOCK_ID = 'supportTickets.adoptUnlockPrompt';

export const DEFAULT_SEVERITY = 'urgent';
export const DEFAULT_PAGE_SIZE = 25;
export const DEFAULT_ADOPT_UNLOCK = true;
