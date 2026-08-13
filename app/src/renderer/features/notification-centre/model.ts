import type { ExportFormat, NotificationSeverity } from '../../core/registry';

/** Stable ids for everything this feature stores. Never renamed. */
export const SETTING_PERSIST = 'notificationCentre.persist';
export const SETTING_RETENTION = 'notificationCentre.retention';
export const SETTING_PAGE_SIZE = 'notificationCentre.pageSize';
export const SETTING_FILTERS_EXPANDED = 'notificationCentre.filtersExpanded';
export const SETTING_STATISTICS_EXPANDED = 'notificationCentre.statisticsExpanded';
export const SETTING_EXPORT_FORMAT = 'notificationCentre.exportFormat';

export const DEFAULT_RETENTION = 500;
export const MIN_RETENTION = 25;
export const MAX_RETENTION = 10000;
export const DEFAULT_PAGE_SIZE = 50;
export const MIN_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 500;
export const DEFAULT_EXPORT_FORMAT: ExportFormat = 'json';

/** The element the palette teleports to, and the anchor for the tab's heading. */
export const CENTRE_ROOT_ID = 'notification-centre-root';
export const CENTRE_SEARCH_ID = 'notification-centre-search';
export const CENTRE_FILTERS_ID = 'notification-centre-filters';
export const CENTRE_STATISTICS_ID = 'notification-centre-statistics';
export const CENTRE_LIST_ID = 'notification-centre-list';

/** The tab the centre is rendered into. Owned by the core shell. */
export const CENTRE_TAB_ID = 'core.notifications';

export const SEVERITIES: NotificationSeverity[] = ['error', 'warning', 'success', 'info', 'progress'];

export const SEVERITY_ICON: Record<NotificationSeverity, string> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
  progress: 'refresh'
};

/**
 * One notification as this feature stores it.
 *
 * Everything here survives a restart except the action closures, which cannot
 * be serialized — only their labels are kept, and a row from an earlier session
 * says so rather than rendering a button that would do nothing.
 */
export interface ArchivedNotification {
  id: string;
  /** The title exactly as the raising feature supplied it (usually an i18n key). */
  title: string;
  body: string;
  severity: NotificationSeverity;
  source: string;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601, or null when it was never dismissed. */
  dismissedAt: string | null;
  progress: number | null;
  /** An http(s) link, which survives a restart because it is only data. */
  link: { label: string; url: string } | null;
  /** Labels of the actions the notification carried, for the record. */
  actionLabels: string[];
  /** `studio.info.startedAt` of the session that raised it. */
  sessionStartedAt: number;
}

/** An archived notification plus what is true about it right now. */
export interface CentreRecord extends ArchivedNotification {
  /** True while the toast is still on screen. */
  showing: boolean;
  /** True when it was raised by the session currently running. */
  fromThisSession: boolean;
  /** True when the original action callbacks are still held in memory. */
  actionsRunnable: boolean;
  /** True when a previous session ended while this was still showing. */
  endedWithItsSession: boolean;
}

export interface ArchiveStatus {
  /** Absolute path of the archive file. */
  path: string;
  /** Whether the user asked for the log to survive a restart. */
  enabled: boolean;
  /** True once a write has actually succeeded this session. */
  written: boolean;
  /** ISO-8601 of the last successful write, or null. */
  lastWriteAt: string | null;
  /** How many records were read back from disk at startup. */
  loadedFromDisk: number;
  /** How many stored records were refused as malformed at startup. */
  refusedOnLoad: number;
  /** Exact reason persistence is not working, or null when it is. */
  error: string | null;
  /** Retention ceiling currently in force. */
  retention: number;
}

export interface SeverityCount {
  severity: NotificationSeverity;
  count: number;
}

export interface SourceCount {
  source: string;
  count: number;
}
