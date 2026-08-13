/**
 * The complete list of IPC channels. Both ends import this file, so the preload
 * bridge cannot invoke a channel the main process never registered, and the main
 * process refuses any channel that is not on this list.
 */

export const INVOKE_CHANNELS = [
  'app:get-info',
  'app:relaunch',
  'app:quit',
  'app:reveal-user-data',

  'window:minimize',
  'window:toggle-maximize',
  'window:maximize',
  'window:unmaximize',
  'window:close',
  'window:set-full-screen',
  'window:get-state',
  'window:set-title',
  'window:set-always-on-top',

  'settings:read-all',
  'settings:write-all',
  'settings:file-path',

  'vault:status',
  'vault:set',
  'vault:get',
  'vault:has',
  'vault:delete',
  'vault:list-accounts',

  'dialog:open-file',
  'dialog:open-folder',
  'dialog:save-file',

  'fs:stat',
  'fs:read-text',
  'fs:write-text',
  'fs:read-directory',
  'fs:ensure-directory',
  'fs:read-base64',

  'shell:open-path',
  'shell:show-item-in-folder',
  'shell:open-external',

  'editor:detect',
  'editor:open',

  'process:spawn',
  'process:write',
  'process:kill',
  'process:list',
  'process:read-output',

  'history:status',
  'history:record',
  'history:list',
  'history:actions',
  'history:read',
  'history:prune',

  'http:request',
  'http:allow',
  'http:rules',
  'http:revoke',

  'worldvault:create',
  'worldvault:status',
  'worldvault:start-runner',
  'worldvault:stop-runner',
  'worldvault:commit-now',
  'worldvault:commits',
  'worldvault:restore',
  'worldvault:request-region-access',
  'worldvault:publish-preflight',
  'worldvault:set-remote',
  'worldvault:push',
  'worldvault:create-github-repo',
  'worldvault:gc',
  'worldvault:prune',
  'worldvault:export-commit-tree'
] as const;

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];

/**
 * The single synchronous channel.
 *
 * `window.studio.info` has to be readable the instant the first renderer module
 * runs, so the preload fetches it synchronously once at startup. Everything else
 * is asynchronous; do not add to this list.
 */
export const SYNC_INFO_CHANNEL = 'app:get-info-sync';

export const EVENT_CHANNELS = [
  'window:state',
  'process:event',
  'dimsum:surprise',
  'app:before-quit',
  'app:theme-source-changed',
  'worldvault:event'
] as const;

export type EventChannel = (typeof EVENT_CHANNELS)[number];

const invokeSet: ReadonlySet<string> = new Set<string>(INVOKE_CHANNELS);
const eventSet: ReadonlySet<string> = new Set<string>(EVENT_CHANNELS);

export function isInvokeChannel(value: string): value is InvokeChannel {
  return invokeSet.has(value);
}

export function isEventChannel(value: string): value is EventChannel {
  return eventSet.has(value);
}
