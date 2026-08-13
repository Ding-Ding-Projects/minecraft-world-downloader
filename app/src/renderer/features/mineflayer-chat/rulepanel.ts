import { el } from '../../core/a11y';
import { compile } from '../../core/regexbuilder';
import type { DataTableHandle, ExportFormat, TabContext } from '../../core/registry';
import {
  COOLDOWN_MAX_MS,
  RULE_ACTIONS,
  minimumCooldown,
  newRule,
  ruleSpeaks,
  sanitizeFlags,
  serializeRule
} from './model';
import type { ChatRule, RuleAction } from './model';
import type { ChatChannel } from './session';
import type { ChatFeatureState } from './state';

/**
 * The "Pattern rules" tab: the rule list, its bulk actions, and the rule
 * editor that composes and previews a rule before it is armed.
 */

const WATCHABLE_CHANNELS: ChatChannel[] = ['chat', 'system', 'game_info'];
const REGEX_FLAG_LETTERS = ['i', 'm', 's', 'u'] as const;

export function mountRulesPanel(host: HTMLElement, ctx: TabContext, state: ChatFeatureState): void {
  const store = state.store;
  host.classList.add('mineflayer-chat-panel');

  host.append(
    ctx.components.topAppBar({ title: 'mineflayer-chat.section.rules', subtitle: 'mineflayer-chat.section.rules.description' })
  );

  const budgetLine = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status', id: 'mineflayer-chat-rules-budget' } });
  host.append(budgetLine);

  function redrawBudget(): void {
    const { used, total } = store.budgetRemaining();
    budgetLine.textContent = ctx.t('mineflayer-chat.rules.budget', '{used} of {total} messages sent by rules in the last minute', {
      values: { used, total }
    });
  }

  const newRuleButton = ctx.components.button({
    label: 'mineflayer-chat.rules.new',
    variant: 'filled',
    icon: 'add',
    onClick: (event) => void openRuleEditor(null, event.currentTarget as HTMLElement)
  });
  host.append(newRuleButton);

  const search = ctx.createSearchBar({
    label: 'mineflayer-chat.rules.search',
    sample: 'Diamonds found\njoined the game\nleft the game',
    onChange: () => sync()
  });
  search.root.id = 'mineflayer-chat-rules-search';
  host.append(search.root);

  const bulkBar = el('div', { className: 'mineflayer-chat-bulkbar', attrs: { role: 'group' } });
  bulkBar.hidden = true;
  host.append(bulkBar);

  const tableHost = el('div', { className: 'mineflayer-chat-table-wrap' });
  host.append(tableHost);

  let table: DataTableHandle<ChatRule> | null = null;

  function filteredRules(): ChatRule[] {
    const query = search.query();
    const all = store.allRules();
    if (query.text.trim() === '') return all;
    return all.filter((rule) => query.matches(rule.name) || query.matches(rule.pattern) || query.matches(rule.payload));
  }

  function channelsLabel(rule: ChatRule): string {
    return rule.channels.map((channel) => ctx.t(`mineflayer-chat.channel.${channel}`, channel)).join(', ');
  }

  function actionLabel(action: RuleAction): string {
    return ctx.t(`mineflayer-chat.rules.action.${action}`, action);
  }

  function rebuildTable(rows: ChatRule[]): void {
    tableHost.textContent = '';
    if (store.allRules().length === 0) {
      table = null;
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayer-chat.rules.empty', 'No pattern rules yet'),
          body: ctx.t('mineflayer-chat.rules.empty.body', 'Create a rule to match incoming messages with a pattern and take one action.'),
          action: { label: 'mineflayer-chat.rules.new', variant: 'tonal', onClick: (event) => void openRuleEditor(null, event.currentTarget as HTMLElement) }
        })
      );
      return;
    }
    table = ctx.components.dataTable<ChatRule>({
      label: ctx.t('mineflayer-chat.section.rules', 'Pattern rules'),
      columns: [
        {
          id: 'enabled',
          label: ctx.t('mineflayer-chat.rules.enabled', 'Enabled'),
          render: (rule) =>
            ctx.components.switchControl({
              label: ctx.t('mineflayer-chat.rules.enabled', 'Enabled') + `: ${rule.name || rule.pattern}`,
              checked: rule.enabled,
              onChange: (checked) => void setRuleEnabled(rule, checked)
            }).root
        },
        {
          id: 'name',
          label: ctx.t('mineflayer-chat.rules.name', 'Rule name'),
          sortable: true,
          value: (rule) => rule.name || rule.pattern
        },
        {
          id: 'pattern',
          label: ctx.t('mineflayer-chat.rules.pattern', 'Pattern'),
          value: (rule) => `/${rule.pattern}/${rule.flags}`
        },
        {
          id: 'action',
          label: ctx.t('mineflayer-chat.rules.action', 'What it does'),
          sortable: true,
          value: (rule) => rule.action,
          render: (rule) => actionLabel(rule.action)
        },
        {
          id: 'channels',
          label: ctx.t('mineflayer-chat.rules.channels', 'Channels this rule watches'),
          value: (rule) => channelsLabel(rule)
        },
        {
          id: 'fired',
          label: ctx.t('mineflayer-chat.column.fired', 'Fired'),
          align: 'end',
          sortable: true,
          value: (rule) => rule.fired
        }
      ],
      rows,
      rowId: (rule) => rule.id,
      selectable: true,
      onActivate: (rule) => void openRuleEditor(rule, host),
      onSelectionChange: () => updateBulkBar(),
      emptyMessage: 'core.search.noMatches'
    });
    tableHost.append(table.root);
  }

  function sync(): void {
    const rows = filteredRules();
    const regimeEmpty = store.allRules().length === 0;
    if ((table === null) !== regimeEmpty || table === null) {
      rebuildTable(rows);
    } else {
      table.setRows(rows);
    }
    updateBulkBar();
  }

  async function setRuleEnabled(rule: ChatRule, checked: boolean): Promise<void> {
    store.setRuleEnabled(rule.id, checked);
    await ctx.history.record(
      `${checked ? 'Enabled' : 'Disabled'} chat rule "${rule.name || rule.pattern}"`,
      'mineflayer-chat.rules',
      { id: rule.id, enabled: checked }
    );
  }

  /* ---------------- bulk actions ---------------- */

  function updateBulkBar(): void {
    bulkBar.textContent = '';
    const ids = table ? table.selection() : [];
    if (ids.length === 0) {
      bulkBar.hidden = true;
      return;
    }
    bulkBar.hidden = false;
    const rules = store.allRules().filter((rule) => ids.includes(rule.id));

    const label = el('span', { className: 'md-typescale-label-large', text: ctx.t('mineflayer-chat.log.selected', '{count} selected', { values: { count: ids.length } }) });
    const shownIds = filteredRules().map((rule) => rule.id);
    const selectShown = ctx.components.button({
      label: ctx.t('mineflayer-chat.select.shown', 'Select all {count} shown', { values: { count: shownIds.length } }),
      variant: 'text',
      onClick: () => {
        table?.setSelection(shownIds);
        updateBulkBar();
      }
    });
    const selectEverything = ctx.components.button({
      label: ctx.t('mineflayer-chat.select.everything', 'Select all {count} in the log', { values: { count: store.allRules().length } }),
      variant: 'text',
      onClick: () => {
        search.clear();
        sync();
        table?.setSelection(store.allRules().map((rule) => rule.id));
        updateBulkBar();
      }
    });
    const invert = ctx.components.button({
      label: 'mineflayer-chat.select.invert',
      variant: 'text',
      onClick: () => {
        const current = new Set(table?.selection() ?? []);
        table?.setSelection(shownIds.filter((id) => !current.has(id)));
        updateBulkBar();
      }
    });
    const clear = ctx.components.button({
      label: 'mineflayer-chat.select.clear',
      variant: 'text',
      onClick: () => {
        table?.clearSelection();
        updateBulkBar();
      }
    });

    const enableButton = ctx.components.button({
      label: 'mineflayer-chat.rules.bulkEnable',
      variant: 'text',
      onClick: (event) => void bulkEnable(rules, true, event.currentTarget as HTMLElement)
    });
    const disableButton = ctx.components.button({
      label: 'mineflayer-chat.rules.bulkDisable',
      variant: 'text',
      onClick: () => void bulkEnable(rules, false, null)
    });
    const editButton = ctx.components.button({
      label: 'mineflayer-chat.rules.edit',
      variant: 'text',
      icon: 'edit',
      disabled: rules.length !== 1,
      disabledReason: ctx.t('mineflayer-chat.rules.edit', 'Edit the rule') + ' — select exactly one rule.',
      onClick: (event) => void openRuleEditor(rules[0], event.currentTarget as HTMLElement)
    });
    const exportButton = ctx.components.button({
      label: 'mineflayer-chat.action.export',
      variant: 'text',
      icon: 'download',
      onClick: () => void exportRules(rules)
    });
    const deleteButton = ctx.components.button({
      label: 'mineflayer-chat.action.delete',
      variant: 'text',
      icon: 'trash',
      danger: true,
      onClick: (event) => void deleteRules(rules, event.currentTarget as HTMLElement)
    });

    bulkBar.append(label, selectShown, selectEverything, invert, clear, ctx.components.divider(true), enableButton, disableButton, editButton, exportButton, deleteButton);
  }

  async function bulkEnable(rules: ChatRule[], enabled: boolean, anchor: HTMLElement | null): Promise<void> {
    const changing = rules.filter((rule) => rule.enabled !== enabled);
    if (changing.length === 0) return;
    if (enabled && anchor) {
      const speaking = changing.filter((rule) => ruleSpeaks(rule)).length;
      if (speaking > 0) {
        const approved = await ctx.confirm.request({
          action: `Enable ${changing.length} chat rules`,
          affected: [
            ctx.t('mineflayer-chat.rules.bulkEnableConfirm', 'Enabling {count} rules, of which {speaking} will send messages or run commands under your account without asking again.', {
              values: { count: changing.length, speaking }
            }),
            ...changing.filter((rule) => ruleSpeaks(rule)).map((rule) => `${rule.name || rule.pattern} → ${actionLabel(rule.action)}: "${rule.payload}"`)
          ],
          irreversible:
            'Once a rule sends a message or runs a command it cannot be unsent. Turning the rule off afterwards does not undo what it already sent.',
          anchor,
          confirmLabel: ctx.t('mineflayer-chat.rules.bulkEnable', 'Enable')
        });
        if (!approved) return;
      }
    }
    for (const rule of changing) store.setRuleEnabled(rule.id, enabled);
    const speaking = changing.filter((rule) => ruleSpeaks(rule)).length;
    await ctx.history.record(
      `${enabled ? 'Enabled' : 'Disabled'} ${changing.length} chat rules`,
      'mineflayer-chat.rules',
      { ids: changing.map((rule) => rule.id), enabled }
    );
    ctx.notify.success(
      ctx.t(enabled ? 'mineflayer-chat.rules.bulkEnable' : 'mineflayer-chat.rules.bulkDisable', enabled ? 'Enable' : 'Disable'),
      ctx.t('mineflayer-chat.rules.enabledCount', '{count} rules enabled, {speaking} of which speak', { values: { count: changing.length, speaking } })
    );
  }

  async function deleteRules(rules: ChatRule[], anchor: HTMLElement): Promise<void> {
    if (rules.length === 0) return;
    const approved = await ctx.confirm.request({
      action: `Delete ${rules.length} chat pattern rules`,
      affected: rules.map((rule) => `${rule.name || rule.pattern}: /${rule.pattern}/${rule.flags} → ${actionLabel(rule.action)}`),
      irreversible: ctx.t(
        'mineflayer-chat.rules.deleteIrreversible',
        'The selected rules and their patterns are removed from the settings file. Their firing counts are lost. The deletion is recorded in local history, and rebuilding a rule means writing its pattern again.'
      ),
      anchor,
      confirmLabel: ctx.t('mineflayer-chat.action.delete', 'Delete')
    });
    if (!approved) return;
    const removed = store.removeRules(new Set(rules.map((rule) => rule.id)));
    await ctx.history.record(`Deleted ${removed.length} chat rules`, 'mineflayer-chat.rules', {
      rules: removed.map((rule) => serializeRule(rule))
    });
    ctx.notify.success(
      ctx.t('mineflayer-chat.action.delete', 'Delete'),
      ctx.t('mineflayer-chat.rules.deleted', '{count} rules removed', { values: { count: removed.length } })
    );
  }

  async function exportRules(rules: ChatRule[]): Promise<void> {
    const scope = rules.length > 0 ? rules : filteredRules();
    if (scope.length === 0) {
      ctx.notify.info(ctx.t('mineflayer-chat.action.export', 'Export'), ctx.t('core.search.noMatches', 'Nothing matched.'));
      return;
    }
    const format: ExportFormat = 'json';
    const path = await ctx.exporter.save(
      scope.map((rule) => serializeRule(rule)),
      format,
      { name: 'mineflayer-chat-rules', schemaVersion: '1', defaultFileName: 'bot-chat-rules.json' }
    );
    if (path) {
      ctx.notify.success(ctx.t('mineflayer-chat.action.export', 'Export'), ctx.t('mineflayer-chat.action.exported', 'Exported to {path}', { values: { path } }));
    }
  }

  /* ================================================================ */
  /* Rule editor                                                       */
  /* ================================================================ */

  async function openRuleEditor(existing: ChatRule | null, anchor: HTMLElement): Promise<void> {
    const draft: ChatRule = existing ? { ...existing, channels: [...existing.channels] } : newRule();
    const isNew = existing === null;

    const body = el('div', { className: 'mineflayer-chat-rule-editor' });

    const nameField = ctx.components.textField({
      label: 'mineflayer-chat.rules.name',
      value: draft.name,
      onChange: (value) => {
        draft.name = value;
      }
    });
    body.append(nameField.root);

    const patternRow = el('div', { className: 'mineflayer-chat-composer__row' });
    const patternField = ctx.components.textField({
      label: 'mineflayer-chat.rules.pattern',
      value: draft.pattern,
      variant: 'outlined',
      supportingText: ctx.t('mineflayer-chat.rules.pattern.help', 'Matched against the message with its formatting removed. Open the builder to compose it and try it against real text.'),
      onChange: (value) => {
        draft.pattern = value;
        refreshWillDo();
      }
    });
    const builderButton = ctx.components.iconButton({
      icon: 'code',
      label: ctx.t('mineflayer-chat.rules.builder', 'Open the pattern builder'),
      onClick: () => {
        const builder = ctx.createRegexBuilder({
          anchor: builderButton,
          initialPattern: draft.pattern,
          initialFlags: draft.flags,
          sample: store.log
            .all()
            .slice(-20)
            .map((record) => record.plain)
            .join('\n'),
          onApply: (regexState) => {
            draft.pattern = regexState.pattern;
            draft.flags = sanitizeFlags(regexState.flags);
            patternField.set(draft.pattern);
            for (const [flag, box] of Object.entries(flagBoxes)) box.set(draft.flags.includes(flag));
            refreshWillDo();
          }
        });
        builder.open();
      }
    });
    patternRow.append(patternField.root, builderButton);
    body.append(patternRow);

    const patternError = el('p', { className: 'mineflayer-chat-composer__warning', attrs: { role: 'status' } });
    patternError.hidden = true;
    body.append(patternError);

    body.append(
      el('p', { className: 'md-typescale-label-large', text: ctx.t('mineflayer-chat.rules.flags', 'Flags') }),
      el('p', { className: 'md-typescale-body-small', text: ctx.t('mineflayer-chat.rules.flags.help', 'i ignores case, m makes ^ and $ match each line, s lets a dot match a newline, u turns on Unicode mode. The global and sticky flags are deliberately not offered: both carry a position between calls, so a rule using one would match every other message.') })
    );
    const flagsRow = el('div', { className: 'mineflayer-chat-rule-editor__flags', attrs: { role: 'group', 'aria-label': ctx.t('mineflayer-chat.rules.flags', 'Flags') } });
    const flagBoxes: Record<string, ReturnType<typeof ctx.components.checkbox>> = {};
    for (const flag of REGEX_FLAG_LETTERS) {
      const box = ctx.components.checkbox({
        label: flag,
        checked: draft.flags.includes(flag),
        onChange: () => {
          draft.flags = sanitizeFlags(
            REGEX_FLAG_LETTERS.filter((candidate) => flagBoxes[candidate].get()).join('')
          );
          refreshWillDo();
        }
      });
      flagBoxes[flag] = box;
      flagsRow.append(box.root);
    }
    body.append(flagsRow);

    body.append(
      el('p', { className: 'md-typescale-label-large', text: ctx.t('mineflayer-chat.rules.channels', 'Channels this rule watches') }),
      el('p', { className: 'md-typescale-body-small', text: ctx.t('mineflayer-chat.rules.channels.help', 'Messages this surface sent are never matched, and neither are the bot’s own messages. That is what stops a reply rule answering itself.') })
    );
    const channelsRow = el('div', { className: 'mineflayer-chat-rule-editor__channels', attrs: { role: 'group', 'aria-label': ctx.t('mineflayer-chat.rules.channels', 'Channels this rule watches') } });
    const channelBoxes: Record<string, ReturnType<typeof ctx.components.checkbox>> = {};
    for (const channel of WATCHABLE_CHANNELS) {
      const box = ctx.components.checkbox({
        label: ctx.t(`mineflayer-chat.channel.${channel}`, channel),
        checked: draft.channels.includes(channel),
        onChange: (checked) => {
          if (checked && !draft.channels.includes(channel)) draft.channels.push(channel);
          if (!checked) draft.channels = draft.channels.filter((candidate) => candidate !== channel);
          refreshWillDo();
        }
      });
      channelBoxes[channel] = box;
      channelsRow.append(box.root);
    }
    body.append(channelsRow);

    const actionSelect = ctx.components.select({
      label: 'mineflayer-chat.rules.action',
      value: draft.action,
      options: RULE_ACTIONS.map((action) => ({ value: action, label: actionLabel(action) })),
      onChange: (value) => {
        draft.action = value as RuleAction;
        rebuildPayloadField();
        refreshWillDo();
      }
    });
    body.append(actionSelect.root);

    const payloadHost = el('div', {});
    body.append(payloadHost);
    let payloadFieldEl: ReturnType<typeof ctx.components.textField> | null = null;

    function rebuildPayloadField(): void {
      payloadHost.textContent = '';
      if (draft.action !== 'reply' && draft.action !== 'command') {
        payloadFieldEl = null;
        return;
      }
      payloadFieldEl = ctx.components.textField({
        label: draft.action === 'reply' ? 'mineflayer-chat.rules.payload.reply' : 'mineflayer-chat.rules.payload.command',
        value: draft.payload,
        multiline: draft.action === 'reply',
        supportingText: ctx.t('mineflayer-chat.rules.payload.help', '$0 is replaced with the whole match and $1 to $9 with the pattern’s capture groups.'),
        onChange: (value) => {
          draft.payload = value;
          refreshWillDo();
        }
      });
      payloadHost.append(payloadFieldEl.root);
    }
    rebuildPayloadField();

    const cooldownSlider = ctx.components.slider({
      label: ctx.t('mineflayer-chat.rules.cooldown', 'Cooldown'),
      min: 0,
      max: COOLDOWN_MAX_MS / 1000,
      step: 1,
      unit: 's',
      value: draft.cooldownMs / 1000,
      onChange: (value) => {
        draft.cooldownMs = Math.round(value * 1000);
        refreshWillDo();
      }
    });
    body.append(cooldownSlider.root);
    body.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('mineflayer-chat.rules.cooldown.help', 'The shortest gap between two firings. A rule that speaks cannot go below two seconds, because a faster one turns a busy channel into a flood the server will act on.') }));

    const speakWarning = el('p', { className: 'mineflayer-chat-rule-editor__speak-warning', attrs: { role: 'status' } });
    speakWarning.hidden = true;
    body.append(speakWarning);

    const willDo = el('p', { className: 'mineflayer-chat-rule-editor__will-do', attrs: { role: 'status' } });
    body.append(
      el('p', { className: 'md-typescale-label-large', text: ctx.t('mineflayer-chat.rules.willDo', 'What this rule will do') }),
      willDo
    );

    function effectiveCooldownMs(): number {
      return Math.max(minimumCooldown(draft.action), draft.cooldownMs);
    }

    function refreshWillDo(): void {
      const channels = draft.channels.map((channel) => ctx.t(`mineflayer-chat.channel.${channel}`, channel)).join(', ') || '—';
      const cooldownSeconds = Math.round(effectiveCooldownMs() / 1000);
      speakWarning.hidden = !ruleSpeaks(draft);
      if (ruleSpeaks(draft)) {
        speakWarning.textContent = ctx.t('mineflayer-chat.rules.speakWarning', 'This rule will speak on your behalf');
      }
      if (draft.action === 'notify') {
        willDo.textContent = ctx.t('mineflayer-chat.rules.willDo.notify', 'When a message on {channels} matches, a notification appears here. Nothing is sent to the server.', { values: { channels } });
      } else if (draft.action === 'reply') {
        willDo.textContent = ctx.t('mineflayer-chat.rules.willDo.reply', 'When a message on {channels} matches, the bot sends “{payload}” in public chat, under your account, at most once every {cooldown} seconds. This speaks on your behalf and everyone on the server sees it.', { values: { channels, payload: draft.payload, cooldown: cooldownSeconds } });
      } else if (draft.action === 'command') {
        willDo.textContent = ctx.t('mineflayer-chat.rules.willDo.command', 'When a message on {channels} matches, the bot runs “{payload}” as a command, under your account, at most once every {cooldown} seconds. What that command does is entirely the server’s business and cannot be undone from here.', { values: { channels, payload: draft.payload, cooldown: cooldownSeconds } });
      } else {
        willDo.textContent = ctx.t('mineflayer-chat.rules.willDo.stop', 'When a message on {channels} matches, no rule after this one looks at that message. Nothing is sent and nothing is shown.', { values: { channels } });
      }
    }
    refreshWillDo();

    const enabledSwitch = ctx.components.switchControl({
      label: ctx.t('mineflayer-chat.rules.enabled', 'Enabled'),
      checked: draft.enabled,
      onChange: (checked) => {
        draft.enabled = checked;
      }
    });
    body.append(enabledSwitch.root);

    // Re-shown on the same body if validation fails, so a mistake never
    // discards what was already typed.
    for (;;) {
      const approved = await ctx.components.dialog({
        title: ctx.t(isNew ? 'mineflayer-chat.rules.new' : 'mineflayer-chat.rules.edit', isNew ? 'New rule' : 'Edit the rule'),
        body,
        confirmLabel: ctx.t('mineflayer-chat.rules.save', 'Save the rule'),
        cancelLabel: ctx.t('mineflayer-chat.rules.cancel', 'Cancel')
      });
      if (!approved) {
        anchor.focus();
        return;
      }

      draft.pattern = draft.pattern.trim();
      const compiled = compile(draft.pattern, draft.flags);
      if (draft.pattern.length === 0 || !compiled.regex) {
        patternError.hidden = false;
        patternError.textContent = ctx.t('mineflayer-chat.rules.needPattern', 'A rule needs a pattern that compiles');
        continue;
      }
      if (draft.channels.length === 0) {
        patternError.hidden = false;
        patternError.textContent = ctx.t('mineflayer-chat.rules.needChannel', 'A rule needs at least one channel to watch');
        continue;
      }
      if (ruleSpeaks(draft) && draft.payload.trim().length === 0) {
        patternError.hidden = false;
        patternError.textContent = ctx.t('mineflayer-chat.rules.needPayload', 'A rule that replies or runs a command needs the text it will send');
        continue;
      }
      patternError.hidden = true;
      draft.cooldownMs = effectiveCooldownMs();
      break;
    }

    store.upsertRule(draft);
    await ctx.history.record(
      isNew ? `Created chat rule "${draft.name || draft.pattern}"` : `Edited chat rule "${draft.name || draft.pattern}"`,
      'mineflayer-chat.rules',
      { id: draft.id, pattern: draft.pattern, flags: draft.flags, action: draft.action, channels: draft.channels, enabled: draft.enabled }
    );
    ctx.notify.success(ctx.t('mineflayer-chat.rules.saved', 'Rule saved'), draft.name || draft.pattern);
    anchor.focus();
  }

  /* ================================================================ */
  /* Wiring                                                            */
  /* ================================================================ */

  const offRules = store.on('rules', () => {
    sync();
    redrawBudget();
  });
  const budgetTimer = window.setInterval(() => redrawBudget(), 10_000);

  state.registerOpenNewRule(() => void openRuleEditor(null, newRuleButton));

  ctx.onDispose(() => {
    offRules();
    window.clearInterval(budgetTimer);
    search.destroy();
    state.registerOpenNewRule(null);
  });

  sync();
  redrawBudget();
}
