import { el } from '../../core/a11y';
import type { TabContext } from '../../core/registry';
import { chat } from './api';
import type { ChatMessageWire } from './api';
import { boundedAffected, selectionToolbar } from './shared';
import type { ChatMessage, ChatSession } from './state';
import { CHAT_NUM_PREDICT_ID, CHAT_TEMPERATURE_ID, CHAT_TOP_P_ID, CHAT_TURN_LIMIT_ID } from './state';
import type { Runtime } from './runtime';
import { clampNumber, formatDuration, formatTimestamp, nowIso } from './util';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** The "Model chat" tab: local sessions against an installed model. */
export function mountChatPanel(host: HTMLElement, ctx: TabContext, rt: Runtime): void {
  const { models } = rt;
  host.className = 'models-panel';

  host.append(
    ctx.components.topAppBar({
      title: ctx.t('models.chat.title', 'Model chat'),
      subtitle: ctx.t('models.chat.subtitle', 'Local sessions against an installed model. Nothing leaves this machine.')
    })
  );

  const layout = el('div', { className: 'models-two-pane' });
  const listPane = el('div', { className: 'models-two-pane__list', attrs: { id: 'models-chat-sessions' } });
  const mainPane = el('div', { className: 'models-two-pane__main' });
  layout.append(listPane, mainPane);
  host.append(layout);

  let activeId: string | null = models.sessions[0]?.id ?? null;
  const listSelection = new Set<string>();
  let searchText = '';
  let waiting = false;
  let waitingStart = 0;
  let waitingTimer: number | undefined;
  let stopRequested = false;
  let waitingLine: HTMLElement | null = null;
  const attachments: Array<{ name: string; size: string; base64: string }> = [];

  function activeSession(): ChatSession | null {
    return models.sessions.find((s) => s.id === activeId) ?? null;
  }

  function turnLimit(): number {
    return clampNumber(ctx.settings.get(CHAT_TURN_LIMIT_ID, 20), 1, 200, 20);
  }

  /* ================================================================ */
  /* Session list                                                      */
  /* ================================================================ */

  function renderList(): void {
    listPane.textContent = '';
    listPane.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.chat.sessions', 'Sessions') }));

    const newButton = ctx.components.button({
      label: 'models.chat.new',
      variant: 'tonal',
      icon: 'add',
      onClick: () => void openNewSessionDialog()
    });
    if (models.installedNames().length === 0) {
      newButton.disabled = true;
      newButton.title = ctx.t('models.chat.noModels', 'No model is installed, so there is nothing to talk to yet. Queue one in the Model store.');
      newButton.setAttribute('aria-description', newButton.title);
    }
    listPane.append(newButton);

    if (models.sessions.length === 0) {
      listPane.append(
        ctx.components.emptyState({
          title: ctx.t('models.chat.empty.title', 'No sessions yet'),
          body: ctx.t('models.chat.empty.body', 'Create a session and choose one of the installed models to talk to.')
        })
      );
      return;
    }

    const search = ctx.createSearchBar({
      label: 'models.chat.search',
      sample: models.sessions.map((s) => `${s.title}\n${s.messages.map((m) => m.content).join('\n')}`).join('\n'),
      initialText: searchText,
      onChange: (q) => {
        searchText = q.text;
        renderSessionRows(q.matches.bind(q));
      }
    });
    ctx.onDispose(() => search.destroy());
    listPane.append(search.root);

    const toolbar = selectionToolbar({
      ctx,
      selection: listSelection,
      shownIds: () => shownSessions().map((s) => s.id),
      allIds: () => models.sessions.map((s) => s.id),
      onChange: () => renderSessionRows(currentMatcher)
    });
    listPane.append(toolbar.root);

    const bulk = el('div', { className: 'models-panel__toolbar' });
    bulk.append(
      ctx.components.button({ label: 'models.chat.delete', variant: 'text', icon: 'trash', danger: true, onClick: (event) => void doDeleteSessions(event.currentTarget as HTMLElement) }),
      ctx.components.button({ label: 'models.chat.export', variant: 'text', icon: 'download', onClick: () => void doExportSessions() })
    );
    listPane.append(bulk);

    const rows = ctx.components.list({ label: 'models.chat.sessions' });
    listPane.append(rows);

    let currentMatcher: (value: string) => boolean = () => true;
    function shownSessions(): ChatSession[] {
      return models.sessions.filter((s) => currentMatcher(s.title) || s.messages.some((m) => currentMatcher(m.content)));
    }

    function renderSessionRows(matcher: (value: string) => boolean): void {
      currentMatcher = matcher;
      rows.textContent = '';
      const shown = shownSessions();
      for (const session of shown) {
        const item = ctx.components.listItem({
          headline: session.title,
          supporting: `${session.model} · ${formatTimestamp(session.updatedAt)}`,
          selectable: true,
          selected: listSelection.has(session.id),
          onActivate: () => {
            activeId = session.id;
            renderList();
            renderRight();
          },
          onSelectChange: (checked) => {
            if (checked) listSelection.add(session.id);
            else listSelection.delete(session.id);
            toolbar.refresh();
          }
        });
        if (session.id === activeId) item.classList.add('md-list-item--active');
        rows.append(item);
      }
      toolbar.refresh();
    }
    renderSessionRows(currentMatcher);
  }

  async function openNewSessionDialog(): Promise<void> {
    const names = models.installedNames();
    if (names.length === 0) return;
    const titleField = ctx.components.textField({ label: 'models.chat.titleField', value: `Session ${models.sessions.length + 1}` });
    const modelSelect = ctx.components.select({ label: 'models.chat.model', value: names[0], options: names.map((n) => ({ value: n, label: n })) });
    const body = el('div', { className: 'models-harness-form' });
    body.append(titleField.root, modelSelect.root);
    const confirmed = await ctx.components.dialog({ title: ctx.t('models.chat.new', 'New session'), body, confirmLabel: 'models.chat.new' });
    if (!confirmed) return;
    const session: ChatSession = {
      id: newId('chat'),
      title: titleField.get().trim() || `Session ${models.sessions.length + 1}`,
      model: modelSelect.get(),
      systemPrompt: '',
      temperature: clampNumber(ctx.settings.get(CHAT_TEMPERATURE_ID, 0.8), 0, 2, 0.8),
      topP: clampNumber(ctx.settings.get(CHAT_TOP_P_ID, 0.9), 0, 1, 0.9),
      numPredict: clampNumber(ctx.settings.get(CHAT_NUM_PREDICT_ID, 512), -1, 32_768, 512),
      messages: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    models.sessions = [session, ...models.sessions];
    models.saveSessions();
    await ctx.history.record(`Created a chat session against ${session.model}`, 'models', { id: session.id, model: session.model });
    activeId = session.id;
    void models.loadDetail(session.model).then(() => renderRight());
    renderList();
    renderRight();
  }

  async function doDeleteSessions(anchor: HTMLElement): Promise<void> {
    const ids = [...listSelection];
    if (ids.length === 0) {
      ctx.notify.info(ctx.t('models.chat.delete', 'Delete the session'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
      return;
    }
    const affected = models.sessions.filter((s) => ids.includes(s.id)).map((s) => s.title);
    const approved = await ctx.confirm.request({
      action: ctx.t('models.confirm.deleteSessionsAction', 'Delete {count} chat session(s)', { values: { count: ids.length } }),
      affected: boundedAffected(affected),
      irreversible: ctx.t('models.confirm.deleteSessionsIrreversible', 'Every message in the deleted sessions is removed from local storage. The model runtime is not touched.'),
      anchor
    });
    if (!approved) return;
    models.sessions = models.sessions.filter((s) => !ids.includes(s.id));
    models.saveSessions();
    if (activeId && ids.includes(activeId)) activeId = models.sessions[0]?.id ?? null;
    await ctx.history.record(`Deleted ${ids.length} chat sessions`, 'models', { ids });
    listSelection.clear();
    renderList();
    renderRight();
  }

  async function doExportSessions(): Promise<void> {
    const ids = listSelection.size > 0 ? [...listSelection] : models.sessions.map((s) => s.id);
    const rows = models.sessions.filter((s) => ids.includes(s.id)).map((s) => ({ ...s, messages: JSON.stringify(s.messages) }));
    const format = models.exportFormat();
    const path = await ctx.exporter.save(rows, format, { name: 'chat-sessions', defaultFileName: `chat-sessions.${format}` });
    if (path) {
      ctx.notify.success(ctx.t('models.chat.export', 'Export the session'), ctx.t('models.notice.exported', 'Written to {path}.', { values: { path } }));
    }
  }

  /* ================================================================ */
  /* Active session                                                     */
  /* ================================================================ */

  function renderRight(): void {
    mainPane.textContent = '';
    const session = activeSession();
    if (!session) {
      mainPane.append(
        ctx.components.emptyState({
          title: ctx.t('models.chat.empty.title', 'No sessions yet'),
          body: ctx.t('models.chat.empty.body', 'Create a session and choose one of the installed models to talk to.')
        })
      );
      return;
    }

    const header = el('div', { className: 'models-panel__toolbar' });
    header.append(el('h2', { className: 'md-typescale-title-medium', text: session.title }));
    header.append(
      ctx.components.button({ label: 'models.chat.rename', variant: 'text', onClick: () => void doRename(session) }),
      ctx.components.button({ label: 'models.chat.export', variant: 'text', icon: 'download', onClick: () => void doExportOne(session) })
    );
    mainPane.append(header);

    const detail = models.detail.get(session.model);
    if (!detail) void models.loadDetail(session.model).then(() => renderRight());

    const paramsRow = el('div', { className: 'models-filters' });
    const systemField = ctx.components.textField({
      label: 'models.chat.system',
      value: session.systemPrompt,
      multiline: true,
      rows: 2,
      onCommit: (v) => {
        session.systemPrompt = v;
        models.saveSessions();
      }
    });
    const temperature = ctx.components.slider({
      label: 'models.chat.temperature',
      min: 0,
      max: 2,
      step: 0.05,
      value: session.temperature,
      onChange: (v) => {
        session.temperature = v;
        models.saveSessions();
      }
    });
    const topP = ctx.components.slider({
      label: 'models.chat.topP',
      min: 0,
      max: 1,
      step: 0.01,
      value: session.topP,
      onChange: (v) => {
        session.topP = v;
        models.saveSessions();
      }
    });
    const numPredict = ctx.components.textField({
      label: 'models.chat.numPredict',
      value: String(session.numPredict),
      type: 'number',
      onCommit: (v) => {
        session.numPredict = clampNumber(v, -1, 32_768, session.numPredict);
        models.saveSessions();
      }
    });
    paramsRow.append(systemField.root, temperature.root, topP.root, numPredict.root);
    mainPane.append(paramsRow);

    const log = el('div', { className: 'models-chat-log', attrs: { role: 'log', 'aria-live': 'polite' } });
    for (const message of session.messages) {
      log.append(renderBubble(message));
    }
    mainPane.append(log);
    window.requestAnimationFrame(() => {
      log.scrollTop = log.scrollHeight;
    });

    mainPane.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.chat.deliveryNote', 'A reply arrives complete rather than a word at a time. The privileged network boundary hands a response back only once it is whole, so there is nothing to render progressively; the timing counters below are the runtime’s own.') }));

    if (waiting) {
      waitingLine = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
      updateWaitingLine(session);
      mainPane.append(waitingLine);
      startWaitingTimer(session);
    } else {
      stopWaitingTimer();
      waitingLine = null;
    }

    const inputWrap = el('div', { className: 'models-chat-input' });
    if (attachments.length > 0) {
      const chips = el('div', { className: 'models-attachments' });
      for (const attachment of attachments) {
        chips.append(
          ctx.components.chip({
            label: `${attachment.name} (${attachment.size})`,
            removable: true,
            onRemove: () => {
              const index = attachments.indexOf(attachment);
              if (index >= 0) attachments.splice(index, 1);
              renderRight();
            }
          })
        );
      }
      inputWrap.append(chips);
    }

    const row = el('div', { className: 'models-chat-input__row' });
    const messageField = ctx.components.textField({ label: 'models.chat.message', multiline: true, rows: 2 });
    row.append(messageField.root);

    const capability = detail?.capabilities.includes('vision') ?? null;
    const attachButton = ctx.components.iconButton({
      icon: 'upload',
      label: ctx.t('models.chat.attachments', 'Attach an image'),
      onClick: () => void doAttach()
    });
    if (!detail) {
      attachButton.disabled = true;
      attachButton.title = ctx.t('models.chat.attachmentsUnknown', '{model} has not reported its capabilities yet. Open it on the Local models tab to read them.', { values: { model: session.model } });
      attachButton.setAttribute('aria-description', attachButton.title);
    } else if (!capability) {
      attachButton.disabled = true;
      attachButton.title = ctx.t('models.chat.attachmentsDisabled', 'The runtime reports no vision capability for {model}, so an image cannot be sent to it. Filter the inventory by the vision capability to find a model that can.', { values: { model: session.model } });
      attachButton.setAttribute('aria-description', attachButton.title);
    }
    row.append(attachButton);

    const sendButton = ctx.components.button({
      label: 'models.chat.send',
      variant: 'filled',
      icon: 'play',
      onClick: () => void doSend(session, messageField.get())
    });
    if (waiting) {
      sendButton.disabled = true;
      sendButton.title = ctx.t('models.chat.waiting', 'Waiting for {model}. {elapsed} elapsed.', { values: { model: session.model, elapsed: '' } });
      sendButton.setAttribute('aria-description', sendButton.title);
    }
    row.append(sendButton);
    if (waiting) {
      row.append(ctx.components.button({ label: 'models.chat.stop', variant: 'text', onClick: () => { stopRequested = true; waiting = false; renderRight(); } }));
    }
    inputWrap.append(row);
    mainPane.append(inputWrap);

    async function doAttach(): Promise<void> {
      const picked = await ctx.studio.dialog.openFile({
        title: ctx.t('models.chat.attachments', 'Attach an image'),
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
      });
      if (!picked.ok || !picked.value || picked.value.length === 0) return;
      const path = picked.value[0];
      const read = await ctx.studio.fs.readBase64(path, 20 * 1024 * 1024);
      if (!read.ok) {
        ctx.notify.error(ctx.t('models.chat.attachments', 'Attach an image'), read.error);
        return;
      }
      const name = path.split(/[\\/]/).pop() ?? path;
      const bytes = Math.round((read.value.length * 3) / 4);
      attachments.push({ name, size: `${Math.round(bytes / 1024)} KiB`, base64: read.value });
      ctx.notify.info(ctx.t('models.chat.attachments', 'Attach an image'), ctx.t('models.chat.attachmentAdded', '{name} attached, {size}.', { values: { name, size: `${Math.round(bytes / 1024)} KiB` } }));
      renderRight();
    }
  }

  function renderBubble(message: ChatMessage): HTMLElement {
    const bubble = el('div', {
      className: `models-chat-bubble models-chat-bubble--${message.role}${message.error ? ' models-chat-bubble--error' : ''}`
    });
    const roleLabel = ctx.t(`models.chat.role.${message.role}`, message.role);
    bubble.append(el('p', { className: 'md-typescale-label-small models-muted', text: `${roleLabel} · ${formatTimestamp(message.createdAt)}` }));
    bubble.append(el('p', { className: 'md-typescale-body-medium', text: message.error ?? message.content }));
    if (message.stats) {
      bubble.append(
        el('p', {
          className: 'md-typescale-label-small models-chat-stats',
          text: ctx.t('models.chat.stats', '{promptTokens} prompt tokens, {responseTokens} reply tokens, {duration} total, {rate} tokens per second.', {
            values: {
              promptTokens: message.stats.promptTokens ?? '—',
              responseTokens: message.stats.responseTokens ?? '—',
              duration: formatDuration(message.stats.totalDurationMs),
              rate: message.stats.tokensPerSecond !== null ? message.stats.tokensPerSecond.toFixed(1) : '—'
            }
          })
        })
      );
    }
    return bubble;
  }

  function updateWaitingLine(session: ChatSession): void {
    if (!waitingLine) return;
    waitingLine.textContent = ctx.t('models.chat.waiting', 'Waiting for {model}. {elapsed} elapsed.', {
      values: { model: session.model, elapsed: formatDuration(Date.now() - waitingStart) }
    });
  }

  function startWaitingTimer(session: ChatSession): void {
    stopWaitingTimer();
    waitingTimer = window.setInterval(() => updateWaitingLine(session), 1000);
  }

  function stopWaitingTimer(): void {
    if (waitingTimer !== undefined) {
      window.clearInterval(waitingTimer);
      waitingTimer = undefined;
    }
  }

  async function doRename(session: ChatSession): Promise<void> {
    const field = ctx.components.textField({ label: 'models.chat.titleField', value: session.title });
    const body = el('div');
    body.append(field.root);
    const confirmed = await ctx.components.dialog({ title: ctx.t('models.chat.rename', 'Rename'), body, confirmLabel: 'core.action.save' });
    if (!confirmed) return;
    const title = field.get().trim();
    if (title === '') return;
    session.title = title;
    session.updatedAt = nowIso();
    models.saveSessions();
    await ctx.history.record(`Renamed a chat session to ${title}`, 'models', { id: session.id, title });
    renderList();
    renderRight();
  }

  async function doExportOne(session: ChatSession): Promise<void> {
    const format = models.exportFormat();
    const path = await ctx.exporter.save([{ ...session, messages: JSON.stringify(session.messages) }], format, {
      name: 'chat-session',
      defaultFileName: `${session.title.replace(/[^a-z0-9-]+/gi, '-')}.${format}`
    });
    if (path) ctx.notify.success(ctx.t('models.chat.export', 'Export the session'), ctx.t('models.chat.exported', 'The session was written to {path}.', { values: { path } }));
  }

  async function doSend(session: ChatSession, text: string): Promise<void> {
    const trimmed = text.trim();
    if (waiting || (trimmed === '' && attachments.length === 0)) return;
    const pendingImages = attachments.map((a) => a.base64);
    attachments.length = 0;

    const userMessage: ChatMessage = { id: newId('msg'), role: 'user', content: trimmed, createdAt: nowIso(), model: session.model, stats: null, error: null };
    session.messages.push(userMessage);
    session.updatedAt = nowIso();
    models.saveSessions();

    waiting = true;
    waitingStart = Date.now();
    stopRequested = false;
    renderRight();

    const limit = turnLimit();
    const history = session.messages.slice(-limit);
    const wireMessages: ChatMessageWire[] = history.map((m) => ({ role: m.role, content: m.content }));
    if (pendingImages.length > 0) {
      const last = wireMessages[wireMessages.length - 1];
      if (last) last.images = pendingImages;
    }
    if (session.systemPrompt.trim() !== '') {
      wireMessages.unshift({ role: 'system', content: session.systemPrompt });
    }

    const options: Record<string, number> = {};
    if (Number.isFinite(session.temperature)) options.temperature = session.temperature;
    if (Number.isFinite(session.topP)) options.top_p = session.topP;
    if (Number.isFinite(session.numPredict)) options.num_predict = session.numPredict;

    await rt.ensureHostsAllowed();
    const config = models.runtimeConfig();
    const result = await chat(ctx.studio, config, { model: session.model, messages: wireMessages, options }, config.timeoutMs);

    if (stopRequested) {
      waiting = false;
      renderRight();
      return;
    }
    waiting = false;

    if (result.ok) {
      session.messages.push({
        id: newId('msg'),
        role: 'assistant',
        content: result.value.content,
        createdAt: nowIso(),
        model: session.model,
        stats: {
          promptTokens: result.value.promptTokens,
          responseTokens: result.value.responseTokens,
          totalDurationMs: result.value.totalDurationMs,
          tokensPerSecond: result.value.tokensPerSecond
        },
        error: null
      });
    } else {
      session.messages.push({ id: newId('msg'), role: 'assistant', content: '', createdAt: nowIso(), model: session.model, stats: null, error: result.error });
    }
    session.updatedAt = nowIso();
    models.saveSessions();
    renderRight();
    renderList();
  }

  renderList();
  renderRight();
  ctx.onDispose(() => stopWaitingTimer());
}
