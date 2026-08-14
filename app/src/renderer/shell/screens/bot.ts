import './bot.css';

import { el } from '../../core/a11y';
import type { AppContext, TabContext } from '../../core/registry';
import { getMineflayerRuntimeContract } from '../../features/mineflayer/bridge';
import type { HostMessage } from '../../features/mineflayer/protocol';
import { mountMovementTab } from '../../features/mineflayer-movement/panel';
import { JUMP_WHEN_STUCK_ID, STUCK_SECONDS_ID } from '../../features/mineflayer-movement/model';
import type { ScreenDefinition } from '../types';

/**
 * The "Bot runner" destination (design lines 879-908, elevated but not
 * railed per `shell/types.ts`'s own docstring).
 *
 * The design mocks up a single-purpose "grid sweep" tool — an area size, a
 * bot-count stepper, a run/stop button, and three stats (chunks captured,
 * bots connected, stuck events). No such scripted area-sweep exists anywhere
 * in this codebase: `features/mineflayer*` connects and pilots real bots one
 * at a time (`mineflayer.bots` for connect/disconnect and live per-bot
 * state, `mineflayerMovement.pilot` for driving whichever one is active),
 * and nothing anywhere counts a "chunks captured this run" or "stuck event"
 * total. Rather than invent a sweep algorithm that isn't there, or a
 * fabricated number for a stat nothing tracks, this screen:
 *
 *  - mounts the two real `features/mineflayer*` tabs directly, giving genuine
 *    start/stop (connect/disconnect), live per-bot state and manual piloting
 *    with its own jump-when-stuck safety net;
 *  - adds a real, live stats row and event log above them, built from the
 *    generic runtime contract `features/mineflayer/bridge.ts` already
 *    exports for exactly this purpose (see its own doc comment: "a future
 *    ... feature has no contract to discover yet" — this screen is that
 *    future caller) — bot count is a genuine live count, the event log
 *    carries the runtime's own timestamps, and "chunks captured" reads the
 *    real, already-published `downloader.status.chunksSaved` setting rather
 *    than a number scoped to "this run" that nothing here could honestly
 *    produce.
 *
 * "Stuck count" specifically has no backing counter anywhere in the
 * codebase — `mineflayerMovement.jumpWhenStuck` is a boolean policy, not a
 * tally of occurrences — so the stat card shows that real on/off state
 * (with its threshold) instead of a fabricated count. This is a deliberate,
 * reported scope limit, not an oversight.
 */

/** Builds the `TabContext` a tab-shaped panel expects, collecting whatever it registers via `onDispose`. */
function asTabContext(ctx: AppContext, tabId: string, disposers: Array<() => void>): TabContext {
  return {
    ...ctx,
    tabId,
    onDispose: (fn: () => void) => {
      disposers.push(fn);
    }
  };
}

function runDisposers(disposers: Array<() => void>): void {
  for (const dispose of disposers) {
    try {
      dispose();
    } catch (error) {
      console.error('Disposing the bot runner screen threw:', error);
    }
  }
}

// Published by `features/downloader/panel.ts`. Read here by the well-known
// key rather than by importing that feature's private module, exactly the
// way `main.ts`'s own status bar already reaches this same value — a
// screen reaching into a sibling feature's internals for a plain settings
// key would be a tighter coupling than the app's own core chrome accepts
// for itself.
const DOWNLOADER_CHUNKS_SAVED_KEY = 'downloader.status.chunksSaved';
const DOWNLOADER_CHUNKS_SAVED_AT_KEY = 'downloader.status.chunksSavedAt';

function formatClock(at: number): string {
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return String(at);
  return parsed.toLocaleTimeString(undefined, { hour12: false });
}

function formatRelative(ctx: AppContext, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return ctx.t('shell.screen.bot.relative.seconds', '{count}s ago', { values: { count: seconds } });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return ctx.t('shell.screen.bot.relative.minutes', '{count}m ago', { values: { count: minutes } });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ctx.t('shell.screen.bot.relative.hours', '{count}h ago', { values: { count: hours } });
  return new Date(then).toLocaleDateString();
}

/** One readable line for a real runtime message, or `null` for a message this log has no use for (`reply`, `state`). */
function describeHostMessage(ctx: AppContext, message: HostMessage): { time: string; text: string } | null {
  switch (message.type) {
    case 'event':
      return {
        time: formatClock(message.at),
        text: ctx.t('shell.screen.bot.log.event', '{bot} — event "{name}"', {
          values: { bot: message.botId, name: message.name }
        })
      };
    case 'status':
      return {
        time: formatClock(message.at),
        text: message.detail
          ? ctx.t('shell.screen.bot.log.statusDetail', '{bot} — {status}: {detail}', {
              values: { bot: message.botId, status: message.status, detail: message.detail }
            })
          : ctx.t('shell.screen.bot.log.status', '{bot} — {status}', {
              values: { bot: message.botId, status: message.status }
            })
      };
    case 'dropped':
      return {
        time: formatClock(message.at),
        text: ctx.t('shell.screen.bot.log.dropped', '{bot} — {count} event(s) dropped under the runtime’s rate budget', {
          values: { bot: message.botId, count: message.count }
        })
      };
    case 'signin':
      return {
        time: formatClock(message.at),
        text: ctx.t('shell.screen.bot.log.signin', '{bot} — Microsoft sign-in code {code}', {
          values: { bot: message.botId, code: message.code }
        })
      };
    case 'log':
      return { time: formatClock(message.at), text: `[${message.level}] ${message.text}` };
    case 'fault':
      return {
        time: formatClock(message.at),
        text: ctx.t('shell.screen.bot.log.fault', 'Runtime fault: {message}', { values: { message: message.message } })
      };
    case 'reply':
    case 'state':
    default:
      // Internal RPC replies and the per-tick state push are not log-worthy
      // here — the per-bot detail card in the mounted "Bots" panel below is
      // the live readout for state, and a reply has no meaning on its own.
      return null;
  }
}

interface StatCardHandle {
  root: HTMLElement;
  setLabel(text: string): void;
  setValue(text: string): void;
  setDescription(text: string): void;
}

function statCard(ctx: AppContext, labelText: string): StatCardHandle {
  const root = ctx.components.card({ variant: 'outlined' });
  root.classList.add('wds-botstat');
  const label = el('span', { className: 'md-typescale-label-medium wds-botstat__label', text: labelText });
  const value = el('span', { className: 'md-typescale-headline-small wds-botstat__value', text: '—' });
  const description = el('span', { className: 'md-typescale-body-small wds-botstat__desc' });
  root.append(label, value, description);
  return {
    root,
    setLabel: (text) => {
      label.textContent = text;
    },
    setValue: (text) => {
      value.textContent = text;
    },
    setDescription: (text) => {
      description.textContent = text;
      description.hidden = text.trim() === '';
    }
  };
}

const LOG_CAP = 200;

const screen: ScreenDefinition = {
  id: 'bot',
  // Reusing the mineflayer feature's own already-registered, already-localized
  // key rather than inventing a new one: a screen module has no `strings`
  // catalogue of its own, and the header resolves `screen.title` with the
  // key itself as the fallback (see `shell/header.ts`), so an unregistered
  // key would render literally.
  title: 'mineflayer.tab.bots',
  subtitle: 'mineflayer.tab.bots.subtitle',
  icon: 'terminal',
  mount(host, ctx) {
    host.classList.add('wds-screen-bot');
    const disposers: Array<() => void> = [];

    /* ---------------- live stats ---------------- */

    // Kept as a mutable reference (not a `const`) so a live language/humour
    // change below can swap in a freshly-translated heading — `sectionHeading`
    // (`core/components.ts`) returns a plain node with no setter API of its
    // own, so a targeted `replaceWith` is the smallest way to repaint it
    // without touching that shared component.
    let statsHeading = ctx.components.sectionHeading({
      title: ctx.t('shell.screen.bot.stats.title', 'Live status'),
      description: ctx.t(
        'shell.screen.bot.stats.description',
        'Real numbers from the running bot runtime and from the downloader’s own chunk count — nothing here is estimated.'
      )
    });
    host.append(statsHeading);

    const statsRow = el('div', { className: 'wds-botstats' });
    const botsStat = statCard(ctx, ctx.t('shell.screen.bot.stat.bots', 'Bots connected'));
    const chunksStat = statCard(ctx, ctx.t('shell.screen.bot.stat.chunks', 'Chunks saved to disk'));
    const stuckStat = statCard(ctx, ctx.t('shell.screen.bot.stat.stuck', 'Stuck detection'));
    statsRow.append(botsStat.root, chunksStat.root, stuckStat.root);
    host.append(statsRow);

    const contract = getMineflayerRuntimeContract();

    const refreshBotsStat = (): void => {
      if (!contract) {
        botsStat.setValue('—');
        botsStat.setDescription(
          ctx.t('shell.screen.bot.stat.bots.unavailable', 'The bot runtime has not started yet.')
        );
        return;
      }
      const bots = contract.listBots();
      botsStat.setValue(String(bots.length));
      botsStat.setDescription(
        bots.length === 0
          ? ctx.t('shell.screen.bot.stat.bots.none', 'Connect one below.')
          : bots.map((bot) => `${bot.name} (${ctx.t(`mineflayer.status.${bot.status}`, bot.status)})`).join(', ')
      );
    };

    const refreshChunksStat = (): void => {
      const count = ctx.settings.get<number | null>(DOWNLOADER_CHUNKS_SAVED_KEY, null);
      const at = ctx.settings.get<string | null>(DOWNLOADER_CHUNKS_SAVED_AT_KEY, null);
      if (count === null || at === null) {
        chunksStat.setValue('—');
        chunksStat.setDescription(ctx.t('shell.screen.bot.stat.chunks.none', 'Not counted yet.'));
        return;
      }
      chunksStat.setValue(new Intl.NumberFormat().format(count));
      chunksStat.setDescription(
        ctx.t('shell.screen.bot.stat.chunks.at', 'Whole world, counted {when}.', { values: { when: formatRelative(ctx, at) } })
      );
    };

    const refreshStuckStat = (): void => {
      const on = ctx.settings.get<boolean>(JUMP_WHEN_STUCK_ID, true) === true;
      const seconds = Number(ctx.settings.get<number>(STUCK_SECONDS_ID, 6));
      stuckStat.setValue(on ? ctx.t('shell.screen.bot.stat.stuck.on', 'On') : ctx.t('shell.screen.bot.stat.stuck.off', 'Off'));
      stuckStat.setDescription(
        on
          ? ctx.t('shell.screen.bot.stat.stuck.threshold', 'Jumps after {seconds}s without moving. No per-event count is kept.', {
              values: { seconds: Number.isFinite(seconds) ? seconds : 6 }
            })
          : ctx.t('shell.screen.bot.stat.stuck.offBody', 'The piloting section below can turn this on.')
      );
    };

    refreshBotsStat();
    refreshChunksStat();
    refreshStuckStat();

    if (contract) {
      disposers.push(contract.onChange(refreshBotsStat));
    }
    disposers.push(
      ctx.settings.onChange((change) => {
        if (change.id === DOWNLOADER_CHUNKS_SAVED_KEY || change.id === DOWNLOADER_CHUNKS_SAVED_AT_KEY) refreshChunksStat();
        if (change.id === JUMP_WHEN_STUCK_ID || change.id === STUCK_SECONDS_ID) refreshStuckStat();
      })
    );

    /* ---------------- live event log ---------------- */

    const logCard = ctx.components.card({ variant: 'outlined' });
    logCard.classList.add('wds-botlog');
    let logHeading = ctx.components.sectionHeading({
      title: ctx.t('shell.screen.bot.log.title', 'Live bot events'),
      description: ctx.t(
        'shell.screen.bot.log.description',
        'Every event, status change, dropped-event notice and sign-in prompt the bot runtime reports, across every connected bot, timestamped as it arrived.'
      )
    });
    logCard.append(logHeading);
    const logList = el('div', {
      className: 'wds-botlog__list',
      attrs: { role: 'log', 'aria-live': 'polite', 'aria-label': ctx.t('shell.screen.bot.log.title', 'Live bot events') }
    });
    const logEmpty = el('p', {
      className: 'md-typescale-body-small',
      text: contract
        ? ctx.t('shell.screen.bot.log.empty', 'Nothing has happened yet. Connect a bot below and its events appear here as they arrive.')
        : ctx.t(
            'shell.screen.bot.log.unavailable',
            'The bot runtime has not started yet, so there is nothing to show here. Connect a bot below to start it.'
          )
    });
    logCard.append(logList, logEmpty);
    host.append(logCard);

    const appendLogRow = (time: string, text: string): void => {
      logEmpty.hidden = true;
      const row = el('div', { className: 'wds-botlog__row' });
      row.append(
        el('span', { className: 'wds-botlog__time md-typescale-label-small', text: time }),
        el('span', { className: 'wds-botlog__text md-typescale-body-small', text })
      );
      logList.append(row);
      while (logList.childElementCount > LOG_CAP) {
        logList.firstElementChild?.remove();
      }
    };

    if (contract) {
      disposers.push(
        contract.onHostMessage((message) => {
          const described = describeHostMessage(ctx, message);
          if (described) appendLogRow(described.time, described.text);
        })
      );
    }

    /* ---------------- start/stop and live per-bot state ---------------- */

    host.append(ctx.components.divider());

    const botsSection = el('div', { className: 'wds-screen-bot__section' });
    host.append(botsSection);
    const botsTab = ctx.registry.tab('mineflayer.bots');
    let botsMissingState: HTMLElement | null = null;
    if (botsTab) {
      // `features/bot/panel.ts` (registered as "mineflayer.bots") already
      // subscribes to `ctx.i18n.onChange` itself, so its mounted content
      // repaints on its own — this screen must not re-mount it on a language
      // change, which would silently drop its live per-bot connection state.
      const dispose = botsTab.mount(botsSection, asTabContext(ctx, 'shell.bot.bots', disposers));
      if (typeof dispose === 'function') disposers.push(dispose);
    } else {
      botsMissingState = ctx.components.emptyState({
        title: ctx.t('shell.screen.bot.bots.missing.title', 'Bot connections are not available yet'),
        body: ctx.t(
          'shell.screen.bot.bots.missing.body',
          'No "mineflayer.bots" destination is registered. The mineflayer feature may not have finished starting.'
        )
      });
      botsSection.append(botsMissingState);
    }

    /* ---------------- manual piloting ---------------- */

    host.append(ctx.components.divider());

    const pilotSection = el('div', { className: 'wds-screen-bot__section' });
    host.append(pilotSection);
    // `features/mineflayer-movement/panel.ts` has no `ctx.i18n.onChange`
    // subscription of its own (confirmed by inspection: this lane may not
    // edit that file), and re-mounting it on every language change would
    // discard whatever piloting state — jump-when-stuck, the active
    // direction — the user was mid-adjustment on. Left as the one real,
    // reported gap: its own copy will not repaint until that file gains the
    // subscription, which belongs to whoever owns it.
    mountMovementTab(pilotSection, asTabContext(ctx, 'shell.bot.pilot', disposers));

    /* ---------------- live language/humour repaint ---------------- */

    // Repaints only this screen's OWN directly-built chrome — the two section
    // headings, the three stat-card labels (their live value/description text
    // is recomputed by re-running the same refresh functions the real-time
    // subscriptions above already call), the log's aria-label and its empty
    // state, and the "bots not available" fallback when it is showing.
    // Deliberately never touches `botsSection`'s or `pilotSection`'s mounted
    // content — see the comments beside each mount above for why.
    disposers.push(
      ctx.i18n.onChange(() => {
        const nextStatsHeading = ctx.components.sectionHeading({
          title: ctx.t('shell.screen.bot.stats.title', 'Live status'),
          description: ctx.t(
            'shell.screen.bot.stats.description',
            'Real numbers from the running bot runtime and from the downloader’s own chunk count — nothing here is estimated.'
          )
        });
        statsHeading.replaceWith(nextStatsHeading);
        statsHeading = nextStatsHeading;

        botsStat.setLabel(ctx.t('shell.screen.bot.stat.bots', 'Bots connected'));
        chunksStat.setLabel(ctx.t('shell.screen.bot.stat.chunks', 'Chunks saved to disk'));
        stuckStat.setLabel(ctx.t('shell.screen.bot.stat.stuck', 'Stuck detection'));
        refreshBotsStat();
        refreshChunksStat();
        refreshStuckStat();

        const nextLogHeading = ctx.components.sectionHeading({
          title: ctx.t('shell.screen.bot.log.title', 'Live bot events'),
          description: ctx.t(
            'shell.screen.bot.log.description',
            'Every event, status change, dropped-event notice and sign-in prompt the bot runtime reports, across every connected bot, timestamped as it arrived.'
          )
        });
        logHeading.replaceWith(nextLogHeading);
        logHeading = nextLogHeading;

        logList.setAttribute('aria-label', ctx.t('shell.screen.bot.log.title', 'Live bot events'));
        logEmpty.textContent = contract
          ? ctx.t('shell.screen.bot.log.empty', 'Nothing has happened yet. Connect a bot below and its events appear here as they arrive.')
          : ctx.t(
              'shell.screen.bot.log.unavailable',
              'The bot runtime has not started yet, so there is nothing to show here. Connect a bot below to start it.'
            );

        if (botsMissingState) {
          const nextMissing = ctx.components.emptyState({
            title: ctx.t('shell.screen.bot.bots.missing.title', 'Bot connections are not available yet'),
            body: ctx.t(
              'shell.screen.bot.bots.missing.body',
              'No "mineflayer.bots" destination is registered. The mineflayer feature may not have finished starting.'
            )
          });
          botsMissingState.replaceWith(nextMissing);
          botsMissingState = nextMissing;
        }
      })
    );

    return () => runDisposers(disposers);
  }
};

export default screen;
