/**
 * The movement tab: read-out, directional pad, look, ray tracing, walk,
 * follow, route preview and the movement log, all in one surface.
 *
 * One perpetual tick loop (period from the `tickMs` setting) drives the
 * read-out, the running walk, the running follow and the route preview while
 * the tab is open, connected or not. Session *state* changes (searching,
 * unavailable, disconnected, connected) are handled separately through
 * `sessionBridge.subscribe`, because those are discrete transitions rather
 * than per-tick data.
 */

import { el } from '../../core/a11y';
import type { ExportFormat, TabContext } from '../../core/registry';
import {
  ARRIVE_RADIUS_ID,
  BLOCK_RAY_DISTANCE_ID,
  CONTROL_SHORTCUTS,
  DEFAULTS,
  ENTITY_RAY_DISTANCE_ID,
  FOLLOW_DISTANCE_ID,
  FOLLOW_ELEMENT,
  JUMP_WHEN_STUCK_ID,
  KEYBOARD_PILOTING_ID,
  LOG_ELEMENT,
  LOG_KEY,
  LOG_LIMIT_ID,
  LOOK_ELEMENT,
  type MovementLogKind,
  type MovementLogOutcome,
  type MovementLogRow,
  PAD_ELEMENT,
  PILOT_KEYS,
  PREVIEW_ELEMENT,
  RAY_ELEMENT,
  READOUT_ELEMENT,
  SHOW_PREVIEW_ID,
  SPRINT_WHILE_WALKING_ID,
  STOP_ELEMENT,
  STUCK_SECONDS_ID,
  TICK_MS_ID,
  TRAIL_POINTS_ID,
  WALK_ELEMENT,
  WALK_TIMEOUT_ID,
  controlLabelKey,
  newLogId,
  normaliseLogRow
} from './model';
import {
  CONTROL_NAMES,
  type ControlName,
  faceName,
  horizontalDistance,
  lookAngles,
  MODIFIER_CONTROLS,
  type MovementBlockHit,
  type MovementBotSession,
  type MovementEntitySummary,
  type MovementSnapshot,
  radiansToDegrees,
  degreesToRadians,
  sessionBridge,
  type Vec3Like
} from './session';

/* ================================================================== */
/* Small helpers                                                       */
/* ================================================================== */

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function fmt(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function fmtVec(value: Vec3Like | null, digits = 1): string {
  if (!value) return '—';
  return `${fmt(value.x, digits)}, ${fmt(value.y, digits)}, ${fmt(value.z, digits)}`;
}

function searchableText(row: MovementLogRow): string {
  return `${row.timestamp} ${row.kind} ${row.outcome} ${row.detail} ${row.position ? fmtVec(row.position) : ''}`;
}

/* ================================================================== */
/* Mount                                                                */
/* ================================================================== */

interface WalkState {
  target: Vec3Like;
  totalDistance: number;
  startedAt: number;
  lastDistance: number;
  lastProgressAt: number;
}

interface FollowState {
  entityId: number;
  entityName: string;
}

export function mountMovementTab(host: HTMLElement, ctx: TabContext): void {
  /* ---------------- persisted state ---------------- */

  let logRows: MovementLogRow[] = (ctx.settings.get<unknown[]>(LOG_KEY, []) ?? [])
    .map((row) => normaliseLogRow(row))
    .filter((row): row is MovementLogRow => row !== null);
  let filtered: MovementLogRow[] = [...logRows];

  /* ---------------- transient state ---------------- */

  let walkState: WalkState | null = null;
  let followState: FollowState | null = null;
  let trail: Vec3Like[] = [];
  let lastBlockHit: MovementBlockHit | null = null;
  let lastEntityHit: MovementEntitySummary | null = null;
  const heldControls = new Set<ControlName>();
  let tickTimer: number | null = null;
  let disposed = false;

  /* ---------------- settings readers ---------------- */

  const num = (id: string, fallback: number): number => {
    const raw = Number(ctx.settings.get<number>(id, fallback));
    return Number.isFinite(raw) ? raw : fallback;
  };
  const bool = (id: string, fallback: boolean): boolean => ctx.settings.get<boolean>(id, fallback) === true;
  const tickMs = (): number => Math.max(20, Math.round(num(TICK_MS_ID, DEFAULTS.tickMs)));

  /* ---------------- the log ---------------- */

  function persistLog(): void {
    ctx.settings.set(LOG_KEY, logRows);
  }

  function pushLog(kind: MovementLogKind, outcome: MovementLogOutcome, detail: string): void {
    const position = sessionBridge.session()?.snapshot()?.position ?? null;
    logRows.push({ id: newLogId(), timestamp: new Date().toISOString(), kind, outcome, detail, position });
    const limit = Math.max(1, Math.round(num(LOG_LIMIT_ID, DEFAULTS.logLimit)));
    if (logRows.length > limit) {
      const dropped = logRows.length - limit;
      logRows.splice(0, dropped);
      ctx.notify.info(
        ctx.t('mineflayerMovement.section.log', 'Movement log'),
        ctx.t('mineflayerMovement.log.trimmed', 'The log reached its {limit}-entry limit, so the oldest {count} were dropped.', {
          values: { limit, count: dropped }
        })
      );
    }
    persistLog();
    refreshFiltered();
  }

  /* ---------------- control hold / release ---------------- */

  function controlLabel(control: ControlName): string {
    return ctx.t(controlLabelKey(control), control);
  }

  async function setControl(control: ControlName, wantHeld: boolean): Promise<void> {
    const currentlyHeld = heldControls.has(control);
    if (currentlyHeld === wantHeld) return;
    if (wantHeld) heldControls.add(control);
    else heldControls.delete(control);
    renderPad();
    const session = sessionBridge.session();
    if (!session) return;
    try {
      await session.setControlState(control, wantHeld);
      pushLog(
        'control',
        wantHeld ? 'started' : 'finished',
        ctx.t(wantHeld ? 'mineflayerMovement.control.pressed' : 'mineflayerMovement.control.releasedOne', wantHeld ? '{name} held' : '{name} released', {
          values: { name: controlLabel(control) }
        })
      );
    } catch (error) {
      pushLog('control', 'failed', `${controlLabel(control)}: ${describeError(error)}`);
    }
  }

  async function releaseAllControls(): Promise<void> {
    if (heldControls.size === 0) return;
    const names = [...heldControls].map((control) => controlLabel(control));
    heldControls.clear();
    renderPad();
    const session = sessionBridge.session();
    if (session) {
      try {
        await session.clearControlStates();
      } catch (error) {
        pushLog('control', 'failed', describeError(error));
        return;
      }
    }
    pushLog('control', 'finished', ctx.t('mineflayerMovement.control.held', 'Held: {names}', { values: { names: names.join(', ') } }));
  }

  async function stopEverything(): Promise<void> {
    await releaseAllControls();
    if (walkState) finishWalk('cancelled');
    if (followState) finishFollow('stopped');
    pushLog('stop', 'finished', ctx.t('mineflayerMovement.stop.done', 'Every control released and every walk cancelled.'));
    ctx.notify.info(ctx.t('mineflayerMovement.stop', 'Stop all movement'), ctx.t('mineflayerMovement.stop.done', 'Every control released and every walk cancelled.'));
  }

  // Lets the palette's "Stop all bot movement" command act immediately
  // instead of merely navigating here first.
  window.mineflayerMovementControls = { stopAll: () => void stopEverything() };
  ctx.onDispose(() => {
    delete window.mineflayerMovementControls;
  });

  /* ================================================================ */
  /* Chrome                                                            */
  /* ================================================================ */

  const panel = el('div', { className: 'mineflayerMovement-panel' });
  host.append(panel);

  panel.append(
    ctx.components.topAppBar({
      title: 'mineflayerMovement.tab.title',
      subtitle: 'mineflayerMovement.tab.subtitle'
    })
  );

  /* ---------------- session banner ---------------- */

  const banner = el('section', { className: 'mineflayerMovement-banner', attrs: { role: 'status' } });
  panel.append(banner);

  function renderBanner(): void {
    banner.replaceChildren();
    const state = sessionBridge.state();
    banner.classList.toggle('mineflayerMovement-banner--connected', state === 'ready');
    if (state === 'searching') {
      banner.append(el('p', { className: 'md-typescale-body-medium', text: ctx.t('mineflayerMovement.session.searching', 'Looking for a bot session.') }));
      return;
    }
    if (state === 'unavailable') {
      banner.append(
        el('p', { className: 'md-typescale-body-medium', text: ctx.t('mineflayerMovement.session.unavailable', 'No bot session module is present in this build.') }),
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('mineflayerMovement.session.unavailable.body', 'The controls below stay visible and disabled rather than disappearing, so what is missing is visible. These are the places that were searched:')
        })
      );
      const list = el('ul', { className: 'mineflayerMovement-banner__searched md-typescale-body-small' });
      for (const place of sessionBridge.searchedFor()) list.append(el('li', { text: place }));
      banner.append(list);
      return;
    }
    const session = sessionBridge.session();
    const snap = session?.snapshot() ?? null;
    if (!snap || !snap.connected) {
      banner.append(el('p', { className: 'md-typescale-body-medium', text: ctx.t('mineflayerMovement.session.disconnected', 'A bot session exists but no bot is connected.') }));
      return;
    }
    banner.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t('mineflayerMovement.session.connected', 'Connected as {name}.', { values: { name: snap.username || '?' } })
      })
    );
  }

  function connectedSession(): MovementBotSession | null {
    const session = sessionBridge.session();
    const snap = session?.snapshot();
    return snap && snap.connected ? session : null;
  }

  function requireReason(): string {
    return ctx.t('mineflayerMovement.session.requires', 'Requires a connected bot.');
  }

  /* ---------------- read-out ---------------- */

  const readoutCard = el('section', { className: 'mineflayerMovement-card', attrs: { id: READOUT_ELEMENT } });
  panel.append(
    ctx.components.sectionHeading({ title: 'mineflayerMovement.section.status', description: 'mineflayerMovement.section.status.description' }),
    readoutCard
  );

  const readoutGrid = el('div', { className: 'mineflayerMovement-readout' });
  readoutCard.append(readoutGrid);

  function readoutItem(labelKey: string, fallback: string): { root: HTMLElement; value: HTMLElement } {
    const value = el('span', { className: 'mineflayerMovement-readout__value md-typescale-body-large', text: '—' });
    const root = el('div', {
      className: 'mineflayerMovement-readout__item',
      children: [el('span', { className: 'mineflayerMovement-readout__label md-typescale-label-medium', text: ctx.t(labelKey, fallback) }), value]
    });
    readoutGrid.append(root);
    return { root, value };
  }

  const readoutPosition = readoutItem('mineflayerMovement.readout.position', 'Position');
  const readoutVelocity = readoutItem('mineflayerMovement.readout.velocity', 'Velocity');
  const readoutSpeed = readoutItem('mineflayerMovement.readout.speed', 'Ground speed');
  const readoutOnGround = readoutItem('mineflayerMovement.readout.onGround', 'On ground');
  const readoutYaw = readoutItem('mineflayerMovement.readout.yaw', 'Yaw');
  const readoutPitch = readoutItem('mineflayerMovement.readout.pitch', 'Pitch');
  const readoutEyeHeight = readoutItem('mineflayerMovement.readout.eyeHeight', 'Eye height');
  const readoutDimension = readoutItem('mineflayerMovement.readout.dimension', 'Dimension');
  const readoutGameMode = readoutItem('mineflayerMovement.readout.gameMode', 'Game mode');
  const readoutPhysics = readoutItem('mineflayerMovement.readout.physics', 'Physics');

  const heldLine = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
  readoutCard.append(heldLine);

  function renderReadout(snap: MovementSnapshot | null): void {
    const dash = ctx.t('mineflayerMovement.readout.unavailable', '—');
    if (!snap || !snap.connected) {
      for (const item of [
        readoutPosition,
        readoutVelocity,
        readoutSpeed,
        readoutOnGround,
        readoutYaw,
        readoutPitch,
        readoutEyeHeight,
        readoutDimension,
        readoutGameMode,
        readoutPhysics
      ]) {
        item.value.textContent = dash;
      }
      heldLine.textContent = ctx.t('mineflayerMovement.control.heldNone', 'No control is held.');
      return;
    }
    readoutPosition.value.textContent = fmtVec(snap.position, 2);
    readoutVelocity.value.textContent = fmtVec(snap.velocity, 3);
    const speed = Math.sqrt(snap.velocity.x * snap.velocity.x + snap.velocity.z * snap.velocity.z);
    readoutSpeed.value.textContent = `${fmt(speed, 3)} m/tick`;
    readoutOnGround.value.textContent = ctx.t(snap.onGround ? 'mineflayerMovement.readout.yes' : 'mineflayerMovement.readout.no', snap.onGround ? 'Yes' : 'No');
    readoutYaw.value.textContent = `${fmt(radiansToDegrees(snap.yaw))}°`;
    readoutPitch.value.textContent = `${fmt(radiansToDegrees(snap.pitch))}°`;
    readoutEyeHeight.value.textContent = `${fmt(snap.eyeHeight, 2)} m`;
    readoutDimension.value.textContent = snap.dimension || dash;
    readoutGameMode.value.textContent = snap.gameMode || dash;
    readoutPhysics.value.textContent = ctx.t(
      snap.physicsEnabled ? 'mineflayerMovement.readout.physics.on' : 'mineflayerMovement.readout.physics.off',
      snap.physicsEnabled ? 'Running' : 'Off'
    );
    const heldNames = CONTROL_NAMES.filter((control) => snap.controls[control]).map((control) => controlLabel(control));
    heldLine.textContent =
      heldNames.length === 0
        ? ctx.t('mineflayerMovement.control.heldNone', 'No control is held.')
        : ctx.t('mineflayerMovement.control.held', 'Held: {names}', { values: { names: heldNames.join(', ') } });
  }

  /* ---------------- the pad ---------------- */

  panel.append(ctx.components.sectionHeading({ title: 'mineflayerMovement.section.pad', description: 'mineflayerMovement.section.pad.description' }));

  const padRoot = el('div', {
    className: 'mineflayerMovement-pad',
    attrs: { id: PAD_ELEMENT, role: 'group', 'aria-label': ctx.t('mineflayerMovement.section.pad', 'Directional controls'), tabindex: '-1' }
  });
  panel.append(padRoot);

  const padButtons = new Map<ControlName, HTMLButtonElement>();

  function wireHold(button: HTMLButtonElement, control: ControlName): void {
    let pointerActive = false;

    button.addEventListener('pointerdown', (event) => {
      pointerActive = true;
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can refuse on some platforms; the button-level
        // blur and keyboard paths still cover release.
      }
      void setControl(control, true);
    });
    const releaseFromPointer = (): void => {
      if (!pointerActive) return;
      pointerActive = false;
      void setControl(control, false);
    };
    button.addEventListener('pointerup', releaseFromPointer);
    button.addEventListener('pointercancel', releaseFromPointer);
    button.addEventListener('lostpointercapture', releaseFromPointer);
    // A pointer that leaves the button without lifting (a drag) still counts
    // as no longer holding *this* button once it is outside it.
    button.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse' && event.buttons === 0) releaseFromPointer();
    });

    let keyActive = false;
    button.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.key === ' ' || event.key === 'Enter') {
        keyActive = true;
        void setControl(control, true);
      }
    });
    const releaseFromKey = (): void => {
      if (!keyActive) return;
      keyActive = false;
      void setControl(control, false);
    };
    button.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Enter') releaseFromKey();
    });

    // The named defect this whole surface exists to prevent: a control that
    // is still held after the thing holding it — pointer or key — is gone.
    button.addEventListener('blur', () => {
      releaseFromPointer();
      releaseFromKey();
    });
  }

  const padButtonBaseTitle = new Map<ControlName, string>();

  function buildPadButton(control: ControlName, extraClass: string): HTMLButtonElement {
    const button = ctx.components.button({
      label: controlLabelKey(control),
      variant: 'outlined',
      disabled: true,
      disabledReason: requireReason()
    });
    button.classList.add(extraClass);
    const baseTitle = `${controlLabel(control)} (${CONTROL_SHORTCUTS[control]})`;
    padButtonBaseTitle.set(control, baseTitle);
    button.title = baseTitle;
    wireHold(button, control);
    padButtons.set(control, button);
    return button;
  }

  const directionalGrid = el('div', { className: 'mineflayerMovement-pad__directional' });
  directionalGrid.append(
    buildPadButton('forward', 'mineflayerMovement-pad__forward'),
    buildPadButton('left', 'mineflayerMovement-pad__left'),
    buildPadButton('back', 'mineflayerMovement-pad__back'),
    buildPadButton('right', 'mineflayerMovement-pad__right')
  );

  const modifierColumn = el('div', { className: 'mineflayerMovement-pad__modifiers' });
  for (const control of MODIFIER_CONTROLS) modifierColumn.append(buildPadButton(control, `mineflayerMovement-pad__${control}`));

  const stopButton = ctx.components.button({
    id: STOP_ELEMENT,
    label: 'mineflayerMovement.stop',
    variant: 'text',
    icon: 'stop',
    onClick: () => void stopEverything()
  });

  const keyboardHint = el('p', { className: 'mineflayerMovement-pad__hint md-typescale-body-small' });

  padRoot.append(directionalGrid, modifierColumn, stopButton, keyboardHint);

  function renderPad(): void {
    for (const control of CONTROL_NAMES) {
      const button = padButtons.get(control);
      if (!button) continue;
      const held = heldControls.has(control);
      button.classList.toggle('mineflayerMovement-control--held', held);
      button.setAttribute('aria-pressed', String(held));
    }
    const session = connectedSession();
    const disabled = !session;
    for (const [control, button] of padButtons) {
      button.disabled = disabled;
      const baseTitle = padButtonBaseTitle.get(control) ?? '';
      button.title = disabled ? `${baseTitle} — ${requireReason()}` : baseTitle;
    }
    keyboardHint.textContent = bool(KEYBOARD_PILOTING_ID, DEFAULTS.keyboardPiloting)
      ? ctx.t('mineflayerMovement.pad.keyboard', 'Keyboard piloting: focus this pad, then hold W, A, S, D, Space, Shift or Ctrl. Escape releases everything.')
      : ctx.t('mineflayerMovement.pad.keyboardOff', 'Keyboard piloting is switched off in settings; the buttons still work with Space and Enter.');
  }

  // Keyboard piloting: scoped to the pad, so a letter typed into a
  // coordinate field elsewhere on this tab is just a letter.
  const heldByKeyboardMap = new Set<string>();
  padRoot.addEventListener('keydown', (event) => {
    if (!bool(KEYBOARD_PILOTING_ID, DEFAULTS.keyboardPiloting)) return;
    if (event.key === 'Escape') {
      void releaseAllControls();
      return;
    }
    const control = PILOT_KEYS[event.code];
    if (!control || event.repeat) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    heldByKeyboardMap.add(event.code);
    void setControl(control, true);
  });
  padRoot.addEventListener('keyup', (event) => {
    const control = PILOT_KEYS[event.code];
    if (!control) return;
    if (!heldByKeyboardMap.delete(event.code)) return;
    void setControl(control, false);
  });

  // Focus genuinely leaving the pad — not just moving from one pad button to
  // another — releases every control the pad is holding, keyboard included.
  padRoot.addEventListener('focusout', (event) => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (next && padRoot.contains(next)) return;
    heldByKeyboardMap.clear();
    void releaseAllControls();
  });

  // The window losing focus entirely (Alt+Tab, a virtual-desktop switch)
  // does not reliably fire a DOM blur on the exact element that was held.
  const onWindowBlur = (): void => {
    heldByKeyboardMap.clear();
    void releaseAllControls();
  };
  window.addEventListener('blur', onWindowBlur);
  ctx.onDispose(() => window.removeEventListener('blur', onWindowBlur));

  /* ================================================================ */
  /* Entity list                                                       */
  /* ================================================================ */

  function entityOptions(): Array<{ value: string; label: string }> {
    const session = connectedSession();
    if (!session) return [];
    return session
      .entities()
      .slice()
      .sort((a, b) => a.distance - b.distance)
      .map((entity) => ({
        value: String(entity.id),
        label: `${entity.displayName}${entity.username ? ` (${entity.username})` : ''} — ${fmt(entity.distance, 1)} m`
      }));
  }

  /**
   * A nearby-entity picker.
   *
   * `ctx.components.select` renders a button that opens a filtered menu
   * overlay, not a native `<select>` — there is no element inside its root to
   * reach in and repopulate. Refreshing the list of entities therefore means
   * building a fresh control and replacing the previous one in the DOM,
   * rather than mutating one in place.
   */
  interface EntityPicker {
    container: HTMLElement;
    getValue(): string | null;
    rebuild(options: Array<{ value: string; label: string }>, disabledReason?: string): void;
  }

  function createEntityPicker(onSelect: (id: string | null) => void): EntityPicker {
    const container = el('div', {});
    let currentValue: string | null = null;

    function rebuild(options: Array<{ value: string; label: string }>, disabledReason?: string): void {
      const stillValid = currentValue !== null && options.some((option) => option.value === currentValue);
      if (!stillValid) currentValue = null;
      const handle = ctx.components.select({
        label: 'mineflayerMovement.look.entityPicker',
        value: currentValue ?? '',
        options: [{ value: '', label: ctx.t('mineflayerMovement.look.entityPicker', 'Nearby entity') }, ...options],
        disabled: disabledReason !== undefined,
        disabledReason,
        onChange: (value) => {
          currentValue = value || null;
          onSelect(currentValue);
        }
      });
      container.replaceChildren(handle.root);
      onSelect(currentValue);
    }

    rebuild([], ctx.t('mineflayerMovement.session.requires', 'Requires a connected bot.'));
    return { container, getValue: () => currentValue, rebuild };
  }

  /* ================================================================ */
  /* Look                                                              */
  /* ================================================================ */

  panel.append(ctx.components.sectionHeading({ title: 'mineflayerMovement.section.look', description: 'mineflayerMovement.section.look.description' }));
  const lookCard = el('section', { className: 'mineflayerMovement-card', attrs: { id: LOOK_ELEMENT } });
  panel.append(lookCard);

  let yawDegrees = 0;
  let pitchDegrees = 0;
  const yawField = ctx.components.textField({
    label: 'mineflayerMovement.look.yaw',
    type: 'number',
    value: '0',
    step: 1,
    onChange: (value) => {
      yawDegrees = Number(value) || 0;
    }
  });
  const pitchField = ctx.components.textField({
    label: 'mineflayerMovement.look.pitch',
    type: 'number',
    value: '0',
    step: 1,
    min: -90,
    max: 90,
    onChange: (value) => {
      pitchDegrees = Number(value) || 0;
    }
  });
  let forceLook = false;
  const forceSwitch = ctx.components.switchControl({
    label: 'mineflayerMovement.look.force',
    checked: false,
    onChange: (checked) => {
      forceLook = checked;
    }
  });
  const applyLookButton = ctx.components.button({
    label: 'mineflayerMovement.look.apply',
    variant: 'filled',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => void applyLook(degreesToRadians(yawDegrees), degreesToRadians(pitchDegrees))
  });
  const lookResult = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });

  async function applyLook(yaw: number, pitch: number): Promise<void> {
    const session = connectedSession();
    if (!session) return;
    try {
      await session.look(yaw, pitch, forceLook);
      const detail = ctx.t('mineflayerMovement.look.applied', 'Looking at yaw {yaw}°, pitch {pitch}°.', {
        values: { yaw: fmt(radiansToDegrees(yaw)), pitch: fmt(radiansToDegrees(pitch)) }
      });
      pushLog('look', 'finished', detail);
      lookResult.textContent = detail;
    } catch (error) {
      const detail = ctx.t('mineflayerMovement.look.failed', 'The look could not be applied: {reason}', { values: { reason: describeError(error) } });
      pushLog('look', 'failed', detail);
      lookResult.textContent = detail;
      ctx.notify.error(ctx.t('mineflayerMovement.section.look', 'Look'), detail);
    }
  }

  lookCard.append(
    el('div', { className: 'mineflayerMovement-coords', children: [yawField.root, pitchField.root] }),
    forceSwitch.root,
    el('p', { className: 'md-typescale-body-small', text: ctx.t('mineflayerMovement.look.force.description', '') }),
    applyLookButton,
    lookResult
  );

  // Look at a point.
  const lookPoint = createCoordinateFields(ctx, 'mineflayerMovement-look-point');
  const lookAtPointButton = ctx.components.button({
    label: 'mineflayerMovement.look.atCoordinates',
    variant: 'outlined',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => {
      const result = lookPoint.parse();
      if (result.kind !== 'ok') {
        ctx.notify.error(ctx.t('mineflayerMovement.look.atCoordinates', 'Look at a point'), describeCoordError(result.kind));
        return;
      }
      void applyLookAtPoint(result.value);
    }
  });

  async function applyLookAtPoint(point: Vec3Like): Promise<void> {
    const session = connectedSession();
    if (!session) return;
    try {
      await session.lookAt(point, forceLook);
      const detail = ctx.t('mineflayerMovement.look.applied', 'Looking at yaw {yaw}°, pitch {pitch}°.', {
        values: { yaw: '—', pitch: '—' }
      });
      pushLog('look', 'finished', `${detail} (${fmtVec(point)})`);
      lookResult.textContent = `${detail} (${fmtVec(point)})`;
    } catch (error) {
      const detail = ctx.t('mineflayerMovement.look.failed', 'The look could not be applied: {reason}', { values: { reason: describeError(error) } });
      pushLog('look', 'failed', detail);
      ctx.notify.error(ctx.t('mineflayerMovement.look.atCoordinates', 'Look at a point'), detail);
    }
  }

  lookCard.append(lookPoint.root, lookAtPointButton);

  // Look at an entity.
  const lookEntityPicker = createEntityPicker(() => undefined);
  const lookEntityRefresh = ctx.components.button({
    label: 'mineflayerMovement.look.entityRefresh',
    variant: 'text',
    icon: 'refresh',
    onClick: () => refreshEntityPickers()
  });
  const lookAtEntityButton = ctx.components.button({
    label: 'mineflayerMovement.look.atEntity',
    variant: 'outlined',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => void applyLookAtEntity()
  });

  async function applyLookAtEntity(): Promise<void> {
    const session = connectedSession();
    const lookEntityId = lookEntityPicker.getValue();
    if (!session) return;
    if (lookEntityId === null) {
      ctx.notify.error(ctx.t('mineflayerMovement.look.atEntity', 'Look at an entity'), ctx.t('mineflayerMovement.follow.needsEntity', 'Choose an entity to follow first.'));
      return;
    }
    const entity = session.entities().find((candidate) => String(candidate.id) === lookEntityId);
    if (!entity) return;
    try {
      await session.lookAt(entity.position, forceLook);
      const detail = ctx.t('mineflayerMovement.look.appliedEntity', 'Looking at {name}.', { values: { name: entity.displayName } });
      pushLog('look', 'finished', detail);
      lookResult.textContent = detail;
    } catch (error) {
      const detail = ctx.t('mineflayerMovement.look.failed', 'The look could not be applied: {reason}', { values: { reason: describeError(error) } });
      pushLog('look', 'failed', detail);
      ctx.notify.error(ctx.t('mineflayerMovement.look.atEntity', 'Look at an entity'), detail);
    }
  }

  lookCard.append(el('div', { className: 'mineflayerMovement-coords__actions', children: [lookEntityPicker.container, lookEntityRefresh, lookAtEntityButton] }));

  /* ================================================================ */
  /* Ray-trace target picker                                          */
  /* ================================================================ */

  panel.append(ctx.components.sectionHeading({ title: 'mineflayerMovement.section.ray', description: 'mineflayerMovement.section.ray.description' }));
  const rayCard = el('section', { className: 'mineflayerMovement-card', attrs: { id: RAY_ELEMENT } });
  panel.append(rayCard);

  const rayResult = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' }, text: ctx.t('mineflayerMovement.ray.noTargetYet', 'No ray has been cast yet.') });

  const traceBlockButton = ctx.components.button({
    label: 'mineflayerMovement.ray.castBlock',
    variant: 'filled',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => void traceBlock()
  });
  const traceEntityButton = ctx.components.button({
    label: 'mineflayerMovement.ray.castEntity',
    variant: 'filled',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => void traceEntity()
  });

  async function traceBlock(): Promise<void> {
    const session = connectedSession();
    if (!session) return;
    if (!session.blockAtCursor) {
      const detail = ctx.t('mineflayerMovement.ray.unavailable', 'This session does not expose the ray-trace route, so the picker cannot fire.');
      rayResult.textContent = detail;
      pushLog('raytrace', 'failed', detail);
      return;
    }
    const distance = num(BLOCK_RAY_DISTANCE_ID, DEFAULTS.blockRayDistance);
    try {
      const hit = await session.blockAtCursor(distance);
      lastBlockHit = hit;
      if (!hit) {
        const detail = ctx.t('mineflayerMovement.ray.noBlock', 'The ray reached {distance} m without meeting a block.', { values: { distance: fmt(distance) } });
        rayResult.textContent = detail;
        pushLog('raytrace', 'observed', detail);
        return;
      }
      const detail = ctx.t('mineflayerMovement.ray.blockHit', '{name} at {x}, {y}, {z} — {distance} m away, face {face}.', {
        values: {
          name: hit.displayName,
          x: fmt(hit.position.x, 0),
          y: fmt(hit.position.y, 0),
          z: fmt(hit.position.z, 0),
          distance: fmt(hit.distance),
          face: hit.face === null ? '—' : faceName(hit.face)
        }
      });
      rayResult.textContent = detail;
      pushLog('raytrace', 'observed', detail);
    } catch (error) {
      const detail = describeError(error);
      rayResult.textContent = detail;
      pushLog('raytrace', 'failed', detail);
    }
  }

  async function traceEntity(): Promise<void> {
    const session = connectedSession();
    if (!session) return;
    if (!session.entityAtCursor) {
      const detail = ctx.t('mineflayerMovement.ray.unavailable', 'This session does not expose the ray-trace route, so the picker cannot fire.');
      rayResult.textContent = detail;
      pushLog('raytrace', 'failed', detail);
      return;
    }
    const distance = num(ENTITY_RAY_DISTANCE_ID, DEFAULTS.entityRayDistance);
    try {
      const hit = await session.entityAtCursor(distance);
      lastEntityHit = hit;
      if (!hit) {
        const detail = ctx.t('mineflayerMovement.ray.noEntity', 'No entity within {distance} m of the line of sight.', { values: { distance: fmt(distance) } });
        rayResult.textContent = detail;
        pushLog('raytrace', 'observed', detail);
        return;
      }
      const detail = ctx.t('mineflayerMovement.ray.entityHit', '{name} at {x}, {y}, {z} — {distance} m away.', {
        values: { name: hit.displayName, x: fmt(hit.position.x, 1), y: fmt(hit.position.y, 1), z: fmt(hit.position.z, 1), distance: fmt(hit.distance) }
      });
      rayResult.textContent = detail;
      pushLog('raytrace', 'observed', detail);
    } catch (error) {
      const detail = describeError(error);
      rayResult.textContent = detail;
      pushLog('raytrace', 'failed', detail);
    }
  }

  rayCard.append(el('div', { className: 'mineflayerMovement-coords__actions', children: [traceBlockButton, traceEntityButton] }), rayResult);

  function rayTargetPosition(): Vec3Like | null {
    return lastBlockHit?.position ?? lastEntityHit?.position ?? null;
  }

  /* ================================================================ */
  /* Coordinate-field helper (shared by walk and look-at-a-point)     */
  /* ================================================================ */

  interface CoordinateFields {
    root: HTMLElement;
    parse(): { kind: 'ok'; value: Vec3Like } | { kind: 'empty' | 'invalid' | 'range' };
    setValue(value: Vec3Like): void;
  }

  function describeCoordError(kind: 'empty' | 'invalid' | 'range'): string {
    if (kind === 'empty') return ctx.t('mineflayerMovement.walk.needsTarget', 'Fill in X, Y and Z first.');
    if (kind === 'range') return ctx.t('mineflayerMovement.field.outOfRange', 'Y must be between -320 and 640, which is the whole playable column.');
    return ctx.t('mineflayerMovement.field.notANumber', 'Type a number, such as -128.5.');
  }

  function createCoordinateFields(tabCtx: TabContext, idPrefix: string): CoordinateFields {
    let raw = { x: '', y: '', z: '' };
    const status = el('p', { className: 'mineflayerMovement-coords__status md-typescale-body-small', attrs: { role: 'status' } });

    function currentParse(): { kind: 'ok'; value: Vec3Like } | { kind: 'empty' | 'invalid' | 'range' } {
      if (raw.x.trim() === '' && raw.y.trim() === '' && raw.z.trim() === '') return { kind: 'empty' };
      const x = Number(raw.x);
      const y = Number(raw.y);
      const z = Number(raw.z);
      if (raw.x.trim() === '' || raw.y.trim() === '' || raw.z.trim() === '' || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return { kind: 'invalid' };
      }
      if (y < -320 || y > 640) return { kind: 'range' };
      return { kind: 'ok', value: { x, y, z } };
    }

    function updateStatus(): void {
      const result = currentParse();
      status.textContent = result.kind === 'ok' || result.kind === 'empty' ? '' : describeCoordError(result.kind);
    }

    const xField = tabCtx.components.textField({ label: 'mineflayerMovement.field.x', type: 'number', step: 0.5, id: `${idPrefix}-x`, onChange: (v) => { raw = { ...raw, x: v }; updateStatus(); } });
    const yField = tabCtx.components.textField({ label: 'mineflayerMovement.field.y', type: 'number', step: 0.5, min: -320, max: 640, id: `${idPrefix}-y`, onChange: (v) => { raw = { ...raw, y: v }; updateStatus(); } });
    const zField = tabCtx.components.textField({ label: 'mineflayerMovement.field.z', type: 'number', step: 0.5, id: `${idPrefix}-z`, onChange: (v) => { raw = { ...raw, z: v }; updateStatus(); } });
    xField.root.classList.add('mineflayerMovement-coords__field');
    yField.root.classList.add('mineflayerMovement-coords__field');
    zField.root.classList.add('mineflayerMovement-coords__field');

    const root = el('div', { className: 'mineflayerMovement-coords', children: [xField.root, yField.root, zField.root, status] });

    return {
      root,
      parse: currentParse,
      setValue: (value: Vec3Like) => {
        raw = { x: String(value.x), y: String(value.y), z: String(value.z) };
        xField.set(raw.x);
        yField.set(raw.y);
        zField.set(raw.z);
        updateStatus();
      }
    };
  }

  /* ================================================================ */
  /* Walk to coordinates                                               */
  /* ================================================================ */

  panel.append(ctx.components.sectionHeading({ title: 'mineflayerMovement.section.walk' }));
  const walkCard = el('section', { className: 'mineflayerMovement-card', attrs: { id: WALK_ELEMENT } });
  panel.append(walkCard);

  walkCard.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('mineflayerMovement.walk.straightLineWarning', '') }));

  const walkTarget = createCoordinateFields(ctx, 'mineflayerMovement-walk');
  walkCard.append(walkTarget.root);

  const useBotPositionButton = ctx.components.button({
    label: 'mineflayerMovement.field.useBotPosition',
    variant: 'text',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => {
      const session = connectedSession();
      const position = session?.snapshot()?.position;
      if (position) walkTarget.setValue(position);
    }
  });
  const useRayTargetButton = ctx.components.button({
    label: 'mineflayerMovement.field.useRayTarget',
    variant: 'text',
    disabled: true,
    disabledReason: ctx.t('mineflayerMovement.field.noRayTarget', 'Cast a ray first; there is no target yet.'),
    onClick: () => {
      const position = rayTargetPosition();
      if (position) walkTarget.setValue(position);
    }
  });
  walkCard.append(el('div', { className: 'mineflayerMovement-coords__actions', children: [useBotPositionButton, useRayTargetButton] }));

  const walkStartButton = ctx.components.button({
    label: 'mineflayerMovement.walk.start',
    variant: 'filled',
    icon: 'play',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => {
      const result = walkTarget.parse();
      if (result.kind !== 'ok') {
        ctx.notify.error(ctx.t('mineflayerMovement.walk.start', 'Walk there'), describeCoordError(result.kind === 'empty' ? 'empty' : result.kind));
        return;
      }
      startWalk(result.value);
    }
  });
  const walkCancelButton = ctx.components.button({
    label: 'mineflayerMovement.walk.cancel',
    variant: 'outlined',
    disabled: true,
    disabledReason: ctx.t('mineflayerMovement.session.requires', 'Requires a connected bot.'),
    onClick: () => finishWalk('cancelled')
  });
  const walkProgress = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });

  walkCard.append(el('div', { className: 'mineflayerMovement-coords__actions', children: [walkStartButton, walkCancelButton] }), walkProgress);

  function startWalk(target: Vec3Like): void {
    const session = connectedSession();
    if (!session) return;
    if (followState) {
      ctx.notify.error(ctx.t('mineflayerMovement.walk.start', 'Walk there'), ctx.t('mineflayerMovement.walk.blockedByFollow', 'A follow is running. Stop following before starting a walk.'));
      return;
    }
    if (walkState) {
      ctx.notify.error(ctx.t('mineflayerMovement.walk.start', 'Walk there'), ctx.t('mineflayerMovement.walk.busy', 'A walk is already running. Cancel it before starting another.'));
      return;
    }
    const snap = session.snapshot();
    const from = snap?.position ?? target;
    const totalDistance = horizontalDistance(from, target);
    walkState = { target, totalDistance, startedAt: Date.now(), lastDistance: totalDistance, lastProgressAt: Date.now() };
    trail = [];
    const detail = ctx.t('mineflayerMovement.walk.progress', '{remaining} m remaining of {total} m.', { values: { remaining: fmt(totalDistance), total: fmt(totalDistance) } });
    pushLog('walk', 'started', `${ctx.t('mineflayerMovement.walk.start', 'Walk there')}: ${fmtVec(target)} — ${detail}`);
    renderSectionState();
  }

  function finishWalk(kind: 'arrived' | 'cancelled' | 'stuck' | 'timeout' | 'lostSession', remainingOverride?: number): void {
    if (!walkState) return;
    const remaining = remainingOverride ?? walkState.lastDistance;
    void setControl('forward', false);
    void setControl('sprint', false);
    walkState = null;
    const key = `mineflayerMovement.walk.${kind}`;
    const detail = ctx.t(key, kind, { values: { remaining: fmt(remaining), x: '', y: '', z: '', distance: fmt(remaining), seconds: fmt(num(WALK_TIMEOUT_ID, DEFAULTS.walkTimeoutSeconds), 0) } });
    walkProgress.textContent = detail;
    pushLog('walk', kind === 'arrived' ? 'finished' : kind === 'cancelled' ? 'cancelled' : 'failed', detail);
    if (kind === 'arrived') ctx.notify.success(ctx.t('mineflayerMovement.walk.start', 'Walk there'), detail);
    else if (kind !== 'cancelled') ctx.notify.warn(ctx.t('mineflayerMovement.walk.start', 'Walk there'), detail);
    renderSectionState();
    renderPreview(sessionBridge.session()?.snapshot() ?? null);
  }

  function walkTick(session: MovementBotSession, snap: MovementSnapshot | null): void {
    if (!walkState) return;
    if (!snap || !snap.connected) {
      finishWalk('lostSession');
      return;
    }
    const remaining = horizontalDistance(snap.position, walkState.target);
    const arriveRadius = num(ARRIVE_RADIUS_ID, DEFAULTS.arriveRadius);
    if (remaining <= arriveRadius) {
      const detail = ctx.t('mineflayerMovement.walk.arrived', 'Arrived within {distance} m of {x}, {y}, {z}.', {
        values: { distance: fmt(remaining), x: fmt(walkState.target.x, 0), y: fmt(walkState.target.y, 0), z: fmt(walkState.target.z, 0) }
      });
      void setControl('forward', false);
      void setControl('sprint', false);
      walkState = null;
      walkProgress.textContent = detail;
      pushLog('walk', 'finished', detail);
      ctx.notify.success(ctx.t('mineflayerMovement.walk.start', 'Walk there'), detail);
      renderSectionState();
      return;
    }
    const walkTimeoutSeconds = num(WALK_TIMEOUT_ID, DEFAULTS.walkTimeoutSeconds);
    if ((Date.now() - walkState.startedAt) / 1000 > walkTimeoutSeconds) {
      const detail = ctx.t('mineflayerMovement.walk.timeout', 'The walk ran past {seconds} s with {remaining} m remaining and was stopped.', {
        values: { seconds: fmt(walkTimeoutSeconds, 0), remaining: fmt(remaining) }
      });
      void setControl('forward', false);
      void setControl('sprint', false);
      walkState = null;
      walkProgress.textContent = detail;
      pushLog('walk', 'failed', detail);
      ctx.notify.warn(ctx.t('mineflayerMovement.walk.start', 'Walk there'), detail);
      renderSectionState();
      return;
    }
    const improved = remaining < walkState.lastDistance - 0.05;
    if (improved) {
      walkState.lastDistance = remaining;
      walkState.lastProgressAt = Date.now();
    } else {
      const stuckSeconds = num(STUCK_SECONDS_ID, DEFAULTS.stuckSeconds);
      if ((Date.now() - walkState.lastProgressAt) / 1000 > stuckSeconds) {
        const detail = ctx.t('mineflayerMovement.walk.stuck', 'The bot stopped making progress with {remaining} m remaining, so the walk was stopped.', {
          values: { remaining: fmt(remaining) }
        });
        void setControl('forward', false);
        void setControl('sprint', false);
        walkState = null;
        walkProgress.textContent = detail;
        pushLog('walk', 'failed', detail);
        ctx.notify.warn(ctx.t('mineflayerMovement.walk.start', 'Walk there'), detail);
        renderSectionState();
        return;
      }
      if (bool(JUMP_WHEN_STUCK_ID, DEFAULTS.jumpWhenStuck) && snap.onGround) void tapJump(session);
    }
    const angles = lookAngles(snap.position, walkState.target);
    void session.look(angles.yaw, 0, false);
    void setControl('forward', true);
    void setControl('sprint', bool(SPRINT_WHILE_WALKING_ID, DEFAULTS.sprintWhileWalking));
    pushTrail(snap.position);
    walkProgress.textContent = ctx.t('mineflayerMovement.walk.progress', '{remaining} m remaining of {total} m.', {
      values: { remaining: fmt(remaining), total: fmt(walkState.totalDistance) }
    });
  }

  async function tapJump(session: MovementBotSession): Promise<void> {
    try {
      await session.setControlState('jump', true);
      window.setTimeout(() => void session.setControlState('jump', false), 150);
    } catch {
      // A missed jump is not fatal to the walk; the stuck timeout still governs it.
    }
  }

  function pushTrail(position: Vec3Like): void {
    trail.push(position);
    const limit = Math.max(2, Math.round(num(TRAIL_POINTS_ID, DEFAULTS.trailPoints)));
    if (trail.length > limit) trail.splice(0, trail.length - limit);
  }

  /* ================================================================ */
  /* Follow an entity                                                  */
  /* ================================================================ */

  panel.append(ctx.components.sectionHeading({ title: 'mineflayerMovement.section.follow' }));
  const followCard = el('section', { className: 'mineflayerMovement-card', attrs: { id: FOLLOW_ELEMENT } });
  panel.append(followCard);

  const followEntityPicker = createEntityPicker(() => undefined);
  const followEntityRefresh = ctx.components.button({
    label: 'mineflayerMovement.look.entityRefresh',
    variant: 'text',
    icon: 'refresh',
    onClick: () => refreshEntityPickers()
  });
  const followStartButton = ctx.components.button({
    label: 'mineflayerMovement.follow.start',
    variant: 'filled',
    icon: 'play',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => {
      const followEntityId = followEntityPicker.getValue();
      if (followEntityId === null) {
        ctx.notify.error(ctx.t('mineflayerMovement.follow.start', 'Follow'), ctx.t('mineflayerMovement.follow.needsEntity', 'Choose an entity to follow first.'));
        return;
      }
      startFollow(followEntityId);
    }
  });
  const followStopButton = ctx.components.button({
    label: 'mineflayerMovement.follow.stop',
    variant: 'outlined',
    disabled: true,
    disabledReason: requireReason(),
    onClick: () => finishFollow('stopped')
  });
  const followProgress = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });

  followCard.append(
    el('div', { className: 'mineflayerMovement-coords__actions', children: [followEntityPicker.container, followEntityRefresh] }),
    el('div', { className: 'mineflayerMovement-coords__actions', children: [followStartButton, followStopButton] }),
    followProgress
  );

  function startFollow(entityId: string): void {
    const session = connectedSession();
    if (!session) return;
    if (walkState) {
      ctx.notify.error(ctx.t('mineflayerMovement.follow.start', 'Follow'), ctx.t('mineflayerMovement.follow.blockedByWalk', 'A walk is running. Cancel it before starting to follow.'));
      return;
    }
    const entity = session.entities().find((candidate) => String(candidate.id) === entityId);
    if (!entity) {
      ctx.notify.error(ctx.t('mineflayerMovement.follow.start', 'Follow'), ctx.t('mineflayerMovement.follow.needsEntity', 'Choose an entity to follow first.'));
      return;
    }
    followState = { entityId: entity.id, entityName: entity.displayName };
    trail = [];
    pushLog('follow', 'started', ctx.t('mineflayerMovement.follow.running', 'Following {name}, {distance} m away, holding at {target} m.', {
      values: { name: entity.displayName, distance: fmt(entity.distance), target: fmt(num(FOLLOW_DISTANCE_ID, DEFAULTS.followDistance)) }
    }));
    renderSectionState();
  }

  function finishFollow(kind: 'stopped' | 'lost'): void {
    if (!followState) return;
    const name = followState.entityName;
    void setControl('forward', false);
    void setControl('sprint', false);
    followState = null;
    const detail = ctx.t(
      kind === 'stopped' ? 'mineflayerMovement.follow.stopped' : 'mineflayerMovement.follow.lost',
      kind === 'stopped' ? 'Stopped following {name}.' : '{name} is no longer in the entity list, so following stopped.',
      { values: { name } }
    );
    followProgress.textContent = detail;
    pushLog('follow', kind === 'stopped' ? 'finished' : 'failed', detail);
    if (kind === 'lost') ctx.notify.warn(ctx.t('mineflayerMovement.follow.start', 'Follow'), detail);
    renderSectionState();
    renderPreview(sessionBridge.session()?.snapshot() ?? null);
  }

  function followTick(session: MovementBotSession, snap: MovementSnapshot | null): void {
    if (!followState) return;
    if (!snap || !snap.connected) {
      finishFollow('lost');
      return;
    }
    const entity = session.entities().find((candidate) => candidate.id === followState?.entityId);
    if (!entity) {
      finishFollow('lost');
      return;
    }
    const followDistance = num(FOLLOW_DISTANCE_ID, DEFAULTS.followDistance);
    followProgress.textContent = ctx.t('mineflayerMovement.follow.running', 'Following {name}, {distance} m away, holding at {target} m.', {
      values: { name: entity.displayName, distance: fmt(entity.distance), target: fmt(followDistance) }
    });
    if (entity.distance > followDistance) {
      const angles = lookAngles(snap.position, entity.position);
      void session.look(angles.yaw, 0, false);
      void setControl('forward', true);
      void setControl('sprint', bool(SPRINT_WHILE_WALKING_ID, DEFAULTS.sprintWhileWalking));
    } else {
      void setControl('forward', false);
      void setControl('sprint', false);
    }
    pushTrail(snap.position);
  }

  /* ================================================================ */
  /* Route preview                                                     */
  /* ================================================================ */

  panel.append(ctx.components.sectionHeading({ title: 'mineflayerMovement.section.preview' }));
  const previewCard = el('section', { className: 'mineflayerMovement-card mineflayerMovement-preview', attrs: { id: PREVIEW_ELEMENT } });
  panel.append(previewCard);
  const previewMessage = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
  const previewLegend = el('p', { className: 'mineflayerMovement-preview__legend md-typescale-body-small' });
  previewCard.append(previewMessage, previewLegend);
  let previewSvg: SVGSVGElement | null = null;

  function renderPreview(snap: MovementSnapshot | null): void {
    if (!bool(SHOW_PREVIEW_ID, DEFAULTS.showPreview)) {
      previewMessage.textContent = ctx.t('mineflayerMovement.preview.hidden', 'The route preview is switched off in settings.');
      previewLegend.textContent = '';
      if (previewSvg) previewSvg.remove();
      previewSvg = null;
      return;
    }
    // A follow has no fixed coordinate — it chases a moving entity — so the
    // target dot is only ever drawn for a walk.
    const target = walkState?.target ?? null;
    if (!target && !followState) {
      previewMessage.textContent = ctx.t('mineflayerMovement.preview.empty', 'Start a walk or a follow and the route appears here.');
      previewLegend.textContent = '';
      if (previewSvg) previewSvg.remove();
      previewSvg = null;
      return;
    }
    const session = sessionBridge.session();
    const pathfinder = session?.pathfinder ?? null;
    previewMessage.textContent = pathfinder
      ? ctx.t('mineflayerMovement.preview.pathfinder', 'A pathfinder named {name} is loaded and its waypoints are drawn.', { values: { name: pathfinder.name } })
      : ctx.t(
          'mineflayerMovement.preview.noPathfinder',
          'No pathfinder is loaded. The vendored library ships forty-one plugins and none of them plans a route, so the line drawn here is the straight line the bot will actually attempt, not a navigated path around obstacles.'
        );
    const current = snap?.position ?? null;
    const points = pathfinder ? pathfinder.path() : trail;
    const bounds = [...points, current, target].filter((p): p is Vec3Like => p !== null);
    if (bounds.length === 0) {
      previewLegend.textContent = '';
      return;
    }
    const minX = Math.min(...bounds.map((p) => p.x)) - 2;
    const maxX = Math.max(...bounds.map((p) => p.x)) + 2;
    const minZ = Math.min(...bounds.map((p) => p.z)) - 2;
    const maxZ = Math.max(...bounds.map((p) => p.z)) + 2;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const size = 320;
    const scale = size / Math.max(spanX, spanZ);
    const toSvg = (p: Vec3Like): [number, number] => [(p.x - minX) * scale, (p.z - minZ) * scale];

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'mineflayerMovement-preview__svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      ctx.t('mineflayerMovement.preview.alt', 'Top-down route diagram: the bot is {remaining} m from the target along a straight line of {total} m.', {
        values: {
          remaining: current && target ? fmt(horizontalDistance(current, target)) : '—',
          total: walkState ? fmt(walkState.totalDistance) : '—'
        }
      })
    );

    if (points.length > 1) {
      const path = document.createElementNS(svgNs, 'polyline');
      path.setAttribute('points', points.map((p) => toSvg(p).join(',')).join(' '));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'var(--md-sys-color-primary)');
      path.setAttribute('stroke-width', '2');
      svg.append(path);
    }
    const dot = (p: Vec3Like, color: string, radius: number): void => {
      const [cx, cy] = toSvg(p);
      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', String(radius));
      circle.setAttribute('fill', color);
      svg.append(circle);
    };
    if (points[0]) dot(points[0], 'var(--md-sys-color-secondary)', 5);
    if (target) dot(target, 'var(--md-sys-color-error)', 6);
    if (current) dot(current, 'var(--md-sys-color-tertiary)', 7);

    if (previewSvg) previewSvg.remove();
    previewSvg = svg;
    previewCard.append(svg);
    previewLegend.textContent = ctx.t('mineflayerMovement.preview.legend', 'Start, target, the bot now, and the ground it has covered.');
  }

  /* ================================================================ */
  /* Section enable/disable                                            */
  /* ================================================================ */

  function renderSectionState(): void {
    const session = connectedSession();
    const connected = session !== null;
    for (const [button, reason] of [
      [applyLookButton, requireReason()],
      [lookAtPointButton, requireReason()],
      [lookAtEntityButton, requireReason()],
      [traceBlockButton, requireReason()],
      [traceEntityButton, requireReason()],
      [useBotPositionButton, requireReason()]
    ] as Array<[HTMLButtonElement, string]>) {
      button.disabled = !connected;
      button.title = connected ? '' : reason;
    }
    useRayTargetButton.disabled = !rayTargetPosition();

    walkStartButton.disabled = !connected || walkState !== null || followState !== null;
    walkStartButton.title = !connected ? requireReason() : followState !== null ? ctx.t('mineflayerMovement.walk.blockedByFollow', '') : walkState !== null ? ctx.t('mineflayerMovement.walk.busy', '') : '';
    walkCancelButton.disabled = walkState === null;

    followStartButton.disabled = !connected || followState !== null || walkState !== null;
    followStopButton.disabled = followState === null;

    renderPad();
  }

  function refreshEntityPickers(): void {
    const connected = connectedSession() !== null;
    const options = entityOptions();
    const disabledReason = !connected
      ? requireReason()
      : options.length === 0
        ? ctx.t('mineflayerMovement.look.entityNone', 'The bot reports no nearby entities.')
        : undefined;
    lookEntityPicker.rebuild(options, disabledReason);
    followEntityPicker.rebuild(options, disabledReason);
  }

  /* ================================================================ */
  /* The movement log                                                  */
  /* ================================================================ */

  panel.append(ctx.components.sectionHeading({ title: 'mineflayerMovement.section.log' }));
  const logCard = el('section', { className: 'mineflayerMovement-card mineflayerMovement-log', attrs: { id: LOG_ELEMENT } });
  panel.append(logCard);

  const search = ctx.createSearchBar({
    label: 'mineflayerMovement.log.search',
    sample: logRows.map(searchableText).join('\n'),
    onChange: (query) => {
      filtered = logRows.filter((row) => query.matches(searchableText(row)));
      refreshTable();
    }
  });
  ctx.onDispose(() => search.destroy());

  const selectionStatus = el('p', { className: 'mineflayerMovement-log__status md-typescale-body-small', attrs: { role: 'status' } });
  const bulkToolbar = el('div', { className: 'mineflayerMovement-log__bulk', attrs: { role: 'group', 'aria-label': ctx.t('mineflayerMovement.section.log', 'Movement log') } });
  const tableWrap = el('div', { className: 'mineflayerMovement-log__table' });
  const emptyState = ctx.components.emptyState({ title: 'mineflayerMovement.log.empty' });
  const noMatchesState = ctx.components.emptyState({ title: 'mineflayerMovement.log.noMatches' });

  const table = ctx.components.dataTable<MovementLogRow>({
    label: 'mineflayerMovement.section.log',
    columns: [
      { id: 'time', label: ctx.t('mineflayerMovement.log.column.time', 'Time'), sortable: true, value: (row) => row.timestamp },
      { id: 'kind', label: ctx.t('mineflayerMovement.log.column.kind', 'Kind'), sortable: true, value: (row) => row.kind },
      { id: 'outcome', label: ctx.t('mineflayerMovement.log.column.outcome', 'Outcome'), sortable: true, value: (row) => row.outcome },
      { id: 'detail', label: ctx.t('mineflayerMovement.log.column.detail', 'What happened'), value: (row) => row.detail },
      { id: 'position', label: ctx.t('mineflayerMovement.log.column.position', 'Position'), align: 'end', value: (row) => (row.position ? fmtVec(row.position) : '—') }
    ],
    rows: filtered,
    rowId: (row) => row.id,
    selectable: true,
    onSelectionChange: () => {
      updateSelectionStatus();
      rebuildBulkButtons();
    }
  });
  tableWrap.append(table.root);
  logCard.append(search.root, selectionStatus, bulkToolbar, tableWrap, emptyState, noMatchesState);

  function updateSelectionStatus(): void {
    const count = table.selection().length;
    selectionStatus.textContent = ctx.t('mineflayerMovement.log.selected', '{count} selected of {total}.', { values: { count, total: logRows.length } });
  }

  function rebuildBulkButtons(): void {
    bulkToolbar.replaceChildren();
    const shownCount = filtered.length;
    const totalCount = logRows.length;
    const selectionCount = table.selection().length;
    const nothingReason = ctx.t('mineflayerMovement.log.empty', 'Nothing has been recorded yet.');
    const noneSelectedReason = ctx.t('mineflayerMovement.log.nothingSelected', 'Select at least one entry first.');

    bulkToolbar.append(
      ctx.components.button({
        label: ctx.t('mineflayerMovement.log.selectAllShown', 'Select the {count} shown', { values: { count: shownCount } }),
        variant: 'text',
        disabled: shownCount === 0,
        disabledReason: nothingReason,
        onClick: () => table.setSelection(filtered.map((row) => row.id))
      }),
      ctx.components.button({
        label: ctx.t('mineflayerMovement.log.selectAllEvery', 'Select all {count}, including the ones the search is hiding', { values: { count: totalCount } }),
        variant: 'text',
        disabled: totalCount === 0,
        disabledReason: nothingReason,
        onClick: () => {
          search.clear();
          filtered = [...logRows];
          refreshTable();
          table.setSelection(logRows.map((row) => row.id));
        }
      }),
      ctx.components.button({
        label: 'mineflayerMovement.log.invert',
        variant: 'text',
        disabled: shownCount === 0,
        disabledReason: nothingReason,
        onClick: () => {
          const current = new Set(table.selection());
          table.setSelection(filtered.filter((row) => !current.has(row.id)).map((row) => row.id));
        }
      }),
      ctx.components.button({
        label: 'mineflayerMovement.log.clearSelection',
        variant: 'text',
        disabled: selectionCount === 0,
        disabledReason: noneSelectedReason,
        onClick: () => table.clearSelection()
      }),
      ctx.components.button({
        label: 'mineflayerMovement.log.delete',
        variant: 'text',
        icon: 'trash',
        danger: true,
        disabled: selectionCount === 0,
        disabledReason: noneSelectedReason,
        onClick: (event) => void deleteSelected(event.currentTarget as HTMLElement)
      }),
      ctx.components.button({
        label: 'mineflayerMovement.log.export',
        variant: 'text',
        icon: 'download',
        disabled: selectionCount === 0,
        disabledReason: noneSelectedReason,
        onClick: (event) => {
          const ids = new Set(table.selection());
          void openLogExportDialog(logRows.filter((row) => ids.has(row.id)), event.currentTarget as HTMLElement);
        }
      })
    );
  }

  async function deleteSelected(anchor: HTMLElement): Promise<void> {
    const ids = new Set(table.selection());
    if (ids.size === 0) return;
    const chosen = logRows.filter((row) => ids.has(row.id));
    const approved = await ctx.confirm.request({
      action: ctx.t('mineflayerMovement.log.delete', 'Delete the selected entries'),
      affected: chosen.map((row) => `${row.timestamp} — ${row.detail}`),
      irreversible: 'The selected movement log entries are removed from the stored log and cannot be recovered.',
      anchor
    });
    if (!approved) return;
    logRows = logRows.filter((row) => !ids.has(row.id));
    persistLog();
    void ctx.history.record('Deleted movement log entries', 'mineflayer-movement', { count: chosen.length });
    refreshFiltered();
    table.clearSelection();
    ctx.notify.success(
      ctx.t('mineflayerMovement.log.delete', 'Delete the selected entries'),
      ctx.t('mineflayerMovement.log.deleted', '{count} log entries deleted.', { values: { count: chosen.length } })
    );
  }

  async function openLogExportDialog(rows: MovementLogRow[], anchor: HTMLElement): Promise<void> {
    if (rows.length === 0) {
      ctx.notify.error(ctx.t('mineflayerMovement.log.export', 'Export the selection'), ctx.t('mineflayerMovement.log.nothingSelected', 'Select at least one entry first.'));
      return;
    }
    let format: ExportFormat = 'json';
    // Reading through a function, rather than the closed-over variable
    // directly, stops TypeScript narrowing every later use to the literal
    // 'json' it was initialised with — the `onChange` handler below really
    // can reassign it before the comparisons further down run.
    const currentFormat = (): ExportFormat => format;
    const body = el('div', {});
    const losses = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
    const records = (): Array<Record<string, unknown>> =>
      rows.map((row) => ({ id: row.id, timestamp: row.timestamp, kind: row.kind, outcome: row.outcome, detail: row.detail, position: row.position ? fmtVec(row.position) : '' }));
    const describe = (): void => {
      const preflight = ctx.exporter.preflight(records(), currentFormat());
      losses.textContent =
        preflight.losses.length === 0
          ? ''
          : ctx.t('mineflayerMovement.log.exportLosses', 'The chosen format cannot carry: {fields}. Everything else is written in full.', {
              values: { fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join('; ') }
            });
    };
    const formatSelect = ctx.components.select({
      label: 'mineflayerMovement.log.exportFormat',
      value: currentFormat(),
      options: ctx.exporter.formats().map((candidate) => ({ value: candidate, label: candidate.toUpperCase() })),
      onChange: (value) => {
        format = value as ExportFormat;
        describe();
      }
    });
    body.append(formatSelect.root, losses);
    describe();
    const approved = await ctx.components.dialog({
      title: ctx.t('mineflayerMovement.log.export', 'Export the selection'),
      body,
      confirmLabel: ctx.t('core.action.export', 'Export')
    });
    if (!approved) {
      anchor.focus();
      return;
    }
    const chosenFormat = currentFormat();
    const extension: string = chosenFormat === 'markdown' ? 'md' : chosenFormat;
    const path = await ctx.exporter.save(records(), chosenFormat, {
      name: 'mineflayer-movement-log',
      schemaVersion: '1',
      defaultFileName: `movement-log.${extension}`
    });
    if (!path) return;
    ctx.notify.success(ctx.t('mineflayerMovement.log.export', 'Export the selection'), ctx.t('mineflayerMovement.log.exported', 'Saved to {path}.', { values: { path } }));
  }

  function refreshTable(): void {
    table.setRows(filtered);
    emptyState.hidden = logRows.length !== 0;
    noMatchesState.hidden = !(logRows.length > 0 && filtered.length === 0);
    tableWrap.hidden = logRows.length === 0 || filtered.length === 0;
    updateSelectionStatus();
    rebuildBulkButtons();
  }

  function refreshFiltered(): void {
    const query = search.query();
    filtered = logRows.filter((row) => query.matches(searchableText(row)));
    refreshTable();
  }

  /* ================================================================ */
  /* Wiring: session state and the tick loop                          */
  /* ================================================================ */

  const unsubscribeBridge = sessionBridge.subscribe(() => {
    renderBanner();
    renderSectionState();
    void refreshEntityPickersIfConnected();
  });
  ctx.onDispose(unsubscribeBridge);

  async function refreshEntityPickersIfConnected(): Promise<void> {
    if (connectedSession()) refreshEntityPickers();
  }

  function scheduleTick(): void {
    if (disposed) return;
    tickTimer = window.setTimeout(runTick, tickMs());
  }

  function runTick(): void {
    tickTimer = null;
    if (disposed) return;
    const session = sessionBridge.session();
    const snap = session?.snapshot() ?? null;
    renderReadout(snap);
    if (session && walkState) walkTick(session, snap);
    if (session && followState) followTick(session, snap);
    renderPreview(snap);
    scheduleTick();
  }

  ctx.onDispose(() => {
    disposed = true;
    if (tickTimer !== null) window.clearTimeout(tickTimer);
  });

  // First paint.
  renderBanner();
  renderSectionState();
  renderPad();
  renderReadout(null);
  renderPreview(null);
  refreshFiltered();
  void sessionBridge.start().then(() => {
    renderBanner();
    renderSectionState();
    void refreshEntityPickersIfConnected();
  });
  scheduleTick();
}
