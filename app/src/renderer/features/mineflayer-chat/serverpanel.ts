import { el } from '../../core/a11y';
import type { TabContext } from '../../core/registry';
import { renderFormatted } from './format';
import type { ChatFeatureState } from './state';

/**
 * The "Server text surfaces" tab: the tab list, boss bars, scoreboards, teams
 * and the current title/subtitle/action bar, all read live from the
 * connected bot session.
 */

function gamemodeLabel(ctx: TabContext, mode: number): string {
  switch (mode) {
    case 0:
      return ctx.t('mineflayer-chat.server.gamemode.0', 'Survival');
    case 1:
      return ctx.t('mineflayer-chat.server.gamemode.1', 'Creative');
    case 2:
      return ctx.t('mineflayer-chat.server.gamemode.2', 'Adventure');
    case 3:
      return ctx.t('mineflayer-chat.server.gamemode.3', 'Spectator');
    default:
      return ctx.t('mineflayer-chat.server.gamemode.unknown', 'Mode {value}', { values: { value: mode } });
  }
}

export function mountServerPanel(host: HTMLElement, ctx: TabContext, state: ChatFeatureState): void {
  const store = state.store;
  const reducedMotion = ctx.a11y.reducedMotion();
  host.classList.add('mineflayer-chat-panel');

  const refreshButton = ctx.components.button({
    label: 'mineflayer-chat.server.refresh',
    variant: 'text',
    icon: 'refresh',
    onClick: () => store.refreshServerState()
  });
  host.append(
    ctx.components.topAppBar({
      title: 'mineflayer-chat.section.server',
      subtitle: 'mineflayer-chat.section.server.description',
      actions: [refreshButton]
    })
  );

  const grid = el('div', { className: 'mineflayer-chat-server-grid' });
  host.append(grid);

  /* ---------------- tab list ---------------- */

  const tablistCard = ctx.components.card({ variant: 'outlined' });
  tablistCard.id = 'mineflayer-chat-server-tablist';
  tablistCard.classList.add('mineflayer-chat-server-card');
  tablistCard.setAttribute('data-appearance-id', 'mineflayer-chat:tablist');
  tablistCard.append(
    el('h2', { className: 'md-typescale-title-small mineflayer-chat-server-card__title', text: ctx.t('mineflayer-chat.server.tablist', 'Tab list') })
  );
  const tablistSearch = ctx.createSearchBar({ label: 'mineflayer-chat.server.tablist.search', onChange: () => drawTablist() });
  tablistCard.append(tablistSearch.root);
  const tablistBody = el('div', {});
  tablistCard.append(tablistBody);
  grid.append(tablistCard);

  function drawTablist(): void {
    tablistBody.textContent = '';
    const server = store.serverState();
    const query = tablistSearch.query();
    const players = server.players.filter(
      (player) => query.text.trim() === '' || query.matches(player.username) || query.matches(player.displayName)
    );
    if (server.players.length === 0) {
      tablistBody.append(
        ctx.components.emptyState({ title: ctx.t('mineflayer-chat.server.tablist.empty', 'The tab list is empty') })
      );
    } else {
      const table = ctx.components.dataTable({
        label: ctx.t('mineflayer-chat.server.tablist', 'Tab list'),
        columns: [
          { id: 'name', label: ctx.t('mineflayer-chat.server.player.name', 'Player'), sortable: true, value: (player) => player.username },
          { id: 'ping', label: ctx.t('mineflayer-chat.server.player.ping', 'Ping'), align: 'end', sortable: true, value: (player) => player.ping },
          {
            id: 'gamemode',
            label: ctx.t('mineflayer-chat.server.player.gamemode', 'Game mode'),
            sortable: true,
            value: (player) => player.gamemode,
            render: (player) => gamemodeLabel(ctx, player.gamemode)
          }
        ],
        rows: players,
        rowId: (player) => player.uuid,
        emptyMessage: 'core.search.noMatches'
      });
      tablistBody.append(table.root);
    }
    if (server.tablist.header) {
      tablistBody.append(el('p', { className: 'md-typescale-label-medium', text: ctx.t('mineflayer-chat.server.tablist.header', 'Tab list header') }));
      const wrap = el('div', {});
      wrap.append(renderFormatted(server.tablist.header, reducedMotion));
      tablistBody.append(wrap);
    }
    if (server.tablist.footer) {
      tablistBody.append(el('p', { className: 'md-typescale-label-medium', text: ctx.t('mineflayer-chat.server.tablist.footer', 'Tab list footer') }));
      const wrap = el('div', {});
      wrap.append(renderFormatted(server.tablist.footer, reducedMotion));
      tablistBody.append(wrap);
    }
  }

  /* ---------------- boss bars ---------------- */

  const bossCard = ctx.components.card({ variant: 'outlined' });
  bossCard.classList.add('mineflayer-chat-server-card');
  bossCard.setAttribute('data-appearance-id', 'mineflayer-chat:bossbars');
  bossCard.append(
    el('h2', { className: 'md-typescale-title-small mineflayer-chat-server-card__title', text: ctx.t('mineflayer-chat.server.bossbars', 'Boss bars') })
  );
  const bossBody = el('div', {});
  bossCard.append(bossBody);
  grid.append(bossCard);

  function drawBossBars(): void {
    bossBody.textContent = '';
    const bars = store.serverState().bossBars;
    if (bars.length === 0) {
      bossBody.append(ctx.components.emptyState({ title: ctx.t('mineflayer-chat.server.bossbars.empty', 'No boss bars are showing') }));
      return;
    }
    for (const bar of bars) {
      const item = el('div', { className: 'mineflayer-chat-server-card' });
      const titleWrap = el('div', {});
      titleWrap.append(renderFormatted(bar.title, reducedMotion));
      item.append(titleWrap);
      item.append(
        ctx.components.linearProgress({ value: Math.max(0, Math.min(1, bar.health)), label: ctx.t('mineflayer-chat.server.bossbars', 'Boss bars') }).root
      );
      const meta = el('div', { className: 'mineflayer-chat-bossbar__meta' });
      meta.append(
        el('span', {
          className: 'md-typescale-body-small',
          text: ctx.t('mineflayer-chat.server.bossbar.progress', '{percent} percent, colour {color}', {
            values: { percent: Math.round(bar.health * 100), color: bar.color }
          })
        })
      );
      if (bar.isDragonBar) meta.append(ctx.components.chip({ label: ctx.t('mineflayer-chat.server.bossbar.dragon', 'Dragon bar') }));
      if (bar.createFog) meta.append(ctx.components.chip({ label: ctx.t('mineflayer-chat.server.bossbar.fog', 'Creates fog') }));
      if (bar.shouldDarkenSky) meta.append(ctx.components.chip({ label: ctx.t('mineflayer-chat.server.bossbar.darkenSky', 'Darkens the sky') }));
      item.append(meta);
      bossBody.append(item, ctx.components.divider());
    }
  }

  /* ---------------- scoreboards ---------------- */

  const scoreCard = ctx.components.card({ variant: 'outlined' });
  scoreCard.classList.add('mineflayer-chat-server-card');
  scoreCard.setAttribute('data-appearance-id', 'mineflayer-chat:scoreboards');
  scoreCard.append(
    el('h2', { className: 'md-typescale-title-small mineflayer-chat-server-card__title', text: ctx.t('mineflayer-chat.server.scoreboards', 'Scoreboards') })
  );
  const scoreBody = el('div', {});
  scoreCard.append(scoreBody);
  grid.append(scoreCard);

  function drawScoreboards(): void {
    scoreBody.textContent = '';
    const boards = store.serverState().scoreboards;
    if (boards.length === 0) {
      scoreBody.append(ctx.components.emptyState({ title: ctx.t('mineflayer-chat.server.scoreboards.empty', 'No scoreboards are showing') }));
      return;
    }
    for (const board of boards) {
      const item = el('div', { className: 'mineflayer-chat-server-card' });
      const titleWrap = el('div', {});
      titleWrap.append(renderFormatted(board.title || board.name, reducedMotion));
      item.append(titleWrap);
      const table = ctx.components.dataTable({
        label: board.title || board.name,
        columns: [
          { id: 'name', label: ctx.t('mineflayer-chat.column.sender', 'Sender'), value: (row) => row.displayName || row.name },
          { id: 'value', label: ctx.t('mineflayer-chat.server.bossbar.progress', 'Value'), align: 'end', sortable: true, value: (row) => row.value }
        ],
        rows: board.items,
        rowId: (row) => row.name,
        emptyMessage: 'core.search.noMatches'
      });
      item.append(table.root);
      item.append(
        el('p', {
          className: 'md-typescale-body-small mineflayer-chat-scoreboard__meta',
          text:
            board.slots.length > 0
              ? ctx.t('mineflayer-chat.server.scoreboard.slots', 'Shown in {slots}', { values: { slots: board.slots.join(', ') } })
              : ctx.t('mineflayer-chat.server.scoreboard.noSlot', 'Not currently in a display slot')
        })
      );
      scoreBody.append(item, ctx.components.divider());
    }
  }

  /* ---------------- teams ---------------- */

  const teamCard = ctx.components.card({ variant: 'outlined' });
  teamCard.classList.add('mineflayer-chat-server-card');
  teamCard.setAttribute('data-appearance-id', 'mineflayer-chat:teams');
  teamCard.append(
    el('h2', { className: 'md-typescale-title-small mineflayer-chat-server-card__title', text: ctx.t('mineflayer-chat.server.teams', 'Teams') })
  );
  const teamBody = el('div', {});
  teamCard.append(teamBody);
  grid.append(teamCard);

  function drawTeams(): void {
    teamBody.textContent = '';
    const teams = store.serverState().teams;
    if (teams.length === 0) {
      teamBody.append(ctx.components.emptyState({ title: ctx.t('mineflayer-chat.server.teams.empty', 'No teams are defined') }));
      return;
    }
    for (const team of teams) {
      const item = el('div', { className: 'mineflayer-chat-server-card' });
      const titleWrap = el('div', {});
      titleWrap.append(renderFormatted(team.prefix + team.name + team.suffix, reducedMotion));
      item.append(titleWrap);
      const meta = el('div', { className: 'mineflayer-chat-team__meta' });
      meta.append(
        el('span', { className: 'md-typescale-body-small', text: ctx.t('mineflayer-chat.server.team.members', '{count} members', { values: { count: team.members.length } }) }),
        ctx.components.chip({
          label: ctx.t(
            team.friendlyFire ? 'mineflayer-chat.server.team.friendlyFire' : 'mineflayer-chat.server.team.noFriendlyFire',
            team.friendlyFire ? 'Friendly fire is on' : 'Friendly fire is off'
          )
        })
      );
      item.append(meta);
      if (team.members.length > 0) {
        item.append(el('p', { className: 'md-typescale-body-small', text: team.members.join(', ') }));
      }
      teamBody.append(item, ctx.components.divider());
    }
  }

  /* ---------------- title / action bar ---------------- */

  const titleCard = ctx.components.card({ variant: 'outlined' });
  titleCard.id = 'mineflayer-chat-server-title';
  titleCard.classList.add('mineflayer-chat-server-card');
  titleCard.setAttribute('data-appearance-id', 'mineflayer-chat:title');
  titleCard.append(
    el('h2', { className: 'md-typescale-title-small mineflayer-chat-server-card__title', text: ctx.t('mineflayer-chat.server.title', 'Title and action bar') })
  );
  const titleBody = el('div', {});
  titleCard.append(titleBody);
  grid.append(titleCard);

  function drawTitle(): void {
    titleBody.textContent = '';
    const server = store.serverState();
    if (server.title === '' && server.subtitle === '' && server.actionBar === '') {
      titleBody.append(ctx.components.emptyState({ title: ctx.t('mineflayer-chat.server.title.empty', 'No title is showing') }));
      return;
    }
    if (server.title) {
      titleBody.append(el('p', { className: 'md-typescale-label-medium', text: ctx.t('mineflayer-chat.server.title.label', 'Title') }));
      const wrap = el('div', {});
      wrap.append(renderFormatted(server.title, reducedMotion));
      titleBody.append(wrap);
    }
    if (server.subtitle) {
      titleBody.append(el('p', { className: 'md-typescale-label-medium', text: ctx.t('mineflayer-chat.server.subtitle.label', 'Subtitle') }));
      const wrap = el('div', {});
      wrap.append(renderFormatted(server.subtitle, reducedMotion));
      titleBody.append(wrap);
    }
    if (server.titleTimes) {
      titleBody.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('mineflayer-chat.server.title.times', 'Fades in over {fadeIn} ticks, stays {stay}, fades out over {fadeOut}', {
            values: { fadeIn: server.titleTimes.fadeIn, stay: server.titleTimes.stay, fadeOut: server.titleTimes.fadeOut }
          })
        })
      );
    }
    if (server.actionBar) {
      titleBody.append(el('p', { className: 'md-typescale-label-medium', text: ctx.t('mineflayer-chat.server.actionbar.label', 'Action bar') }));
      const wrap = el('div', {});
      wrap.append(renderFormatted(server.actionBar, reducedMotion));
      titleBody.append(wrap);
    }
  }

  /* ---------------- wiring ---------------- */

  function drawAll(): void {
    drawTablist();
    drawBossBars();
    drawScoreboards();
    drawTeams();
    drawTitle();
  }

  const offServer = store.on('server', () => drawAll());
  ctx.onDispose(() => {
    offServer();
    tablistSearch.destroy();
  });

  drawAll();
}
