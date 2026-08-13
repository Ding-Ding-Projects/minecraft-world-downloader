/**
 * Registration: every route that avoids retyping a secret by hand, and the
 * pairing check that arms the factor.
 *
 * Retyping thirty-two base32 characters off another screen is where a pairing
 * goes wrong, so the routes exist in this order of preference: paste the link,
 * read a picture of the code, scan with a camera when the machine has one, and
 * type it only as a last resort. Whatever route is used, the parameters the
 * source states are honoured rather than replaced with local defaults.
 *
 * A secret created HERE must be checked with a live code before it is saved,
 * because nothing else has ever paired with it and a matching code is the only
 * proof the pairing took. A secret that came from somewhere else is offered the
 * same check, and the user can say plainly that they cannot run it right now —
 * in which case the entry is saved and marked, rather than the application
 * pretending a check happened.
 */

import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';
import { generateSecret, verifyTotp } from '../../core/totp';
import { correctedNow } from './clock';
import {
  ALGORITHMS,
  type AuthenticatorEntry,
  DEFAULTS,
  LIMITS,
  type PairingParameters,
  PairingUriError,
  buildPairingUri,
  groupSecret,
  newEntryId,
  normalizeSecret,
  parsePairingUri,
  validateEntryFields
} from './model';
import { QrReadError, decodeBlob, decodeImageData } from './qrdecode';
import { encodeQr, qrToSvg } from './qrencode';
import { store } from './store';

export const DEFAULT_ALGORITHM_ID = 'authenticator.default.algorithm';
export const DEFAULT_DIGITS_ID = 'authenticator.default.digits';
export const DEFAULT_PERIOD_ID = 'authenticator.default.period';
export const QR_MODULE_SIZE_ID = 'authenticator.qr.moduleSize';

type Route = 'generate' | 'uri' | 'image' | 'camera' | 'manual';

interface Draft extends PairingParameters {
  /** True when this application generated the secret in this session. */
  generated: boolean;
  label: string;
  icon: string;
  note: string;
  group: string | null;
}

/**
 * Opens the registration flow anchored beside the control that started it.
 *
 * `onSaved` runs once an entry has actually been written, so the caller can
 * refresh without polling.
 */
export function openRegistration(
  ctx: AppContext,
  anchor: HTMLElement,
  onSaved: (entry: AuthenticatorEntry) => void
): void {
  let stopCamera: (() => void) | null = null;

  const overlay = ctx.overlay.open({
    anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: ctx.t('authenticator.add.title', 'Add a one-time code account'),
    resizeKey: 'authenticator-register',
    dragKey: 'authenticator-register',
    onClose: () => {
      // A camera left running behind a closed dialog is a light that stays on
      // for no reason, so the stream is stopped on every route out of here.
      stopCamera?.();
      stopCamera = null;
    }
  });

  const body = overlay.body;
  body.classList.add('authenticator-register');

  const draft: Draft = {
    issuer: '',
    account: '',
    secret: '',
    algorithm: readAlgorithm(ctx),
    digits: readDigits(ctx),
    period: readPeriod(ctx),
    generated: false,
    label: '',
    icon: 'key',
    note: '',
    group: null
  };

  let route: Route = 'uri';

  const status = el('p', {
    className: 'authenticator-register__status md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const say = (message: string, tone: 'info' | 'error' = 'info'): void => {
    status.textContent = message;
    status.classList.toggle('authenticator-register__status--error', tone === 'error');
    if (tone === 'error') ctx.a11y.announce(message, true);
  };

  /* ---------------- the route picker ---------------- */

  const routeHost = el('div', { className: 'authenticator-register__route' });
  const routePicker = ctx.components.segmentedButton({
    label: 'authenticator.add.route',
    value: route,
    options: [
      { value: 'uri', label: 'authenticator.add.route.uri', icon: 'code' },
      { value: 'image', label: 'authenticator.add.route.image', icon: 'file' },
      { value: 'camera', label: 'authenticator.add.route.camera', icon: 'visibility' },
      { value: 'generate', label: 'authenticator.add.route.generate', icon: 'key' },
      { value: 'manual', label: 'authenticator.add.route.manual', icon: 'edit' }
    ],
    onChange: (value) => {
      stopCamera?.();
      stopCamera = null;
      route = value as Route;
      drawRoute();
    }
  });
  routeHost.append(routePicker.root);

  const routeBody = el('div', { className: 'authenticator-register__body' });

  /* ---------------- the details form ---------------- */

  const details = el('div', { className: 'authenticator-register__details' });

  const issuerField = ctx.components.textField({
    label: 'authenticator.add.issuer',
    supportingText: 'authenticator.add.issuer.hint',
    onChange: (value) => {
      draft.issuer = value;
      refreshPairing();
    }
  });
  const accountField = ctx.components.textField({
    label: 'authenticator.add.account',
    supportingText: 'authenticator.add.account.hint',
    onChange: (value) => {
      draft.account = value;
      refreshPairing();
    }
  });
  const algorithmField = ctx.components.select({
    label: 'authenticator.add.algorithm',
    value: draft.algorithm,
    options: ALGORITHMS.map((algorithm) => ({ value: algorithm, label: algorithm })),
    onChange: (value) => {
      draft.algorithm = (ALGORITHMS.find((candidate) => candidate === value) ?? DEFAULTS.algorithm) as Draft['algorithm'];
      refreshPairing();
    }
  });
  const digitsField = ctx.components.select({
    label: 'authenticator.add.digits',
    value: String(draft.digits),
    options: [6, 7, 8].map((digits) => ({ value: String(digits), label: String(digits) })),
    onChange: (value) => {
      draft.digits = Number(value);
      refreshPairing();
    }
  });
  const periodField = ctx.components.textField({
    label: 'authenticator.add.period',
    type: 'number',
    min: LIMITS.minPeriod,
    max: LIMITS.maxPeriod,
    value: String(draft.period),
    onCommit: (value) => {
      const parsed = Number.parseInt(value, 10);
      draft.period = Number.isInteger(parsed) ? parsed : DEFAULTS.period;
      periodField.set(String(draft.period));
      refreshPairing();
    }
  });

  const labelField = ctx.components.textField({
    label: 'authenticator.row.label',
    onChange: (value) => {
      draft.label = value;
    }
  });
  const noteField = ctx.components.textField({
    label: 'authenticator.row.note',
    onChange: (value) => {
      draft.note = value.slice(0, LIMITS.maxNoteLength);
    }
  });

  details.append(
    ctx.components.sectionHeading({ title: 'authenticator.add.title' }),
    issuerField.root,
    accountField.root,
    labelField.root,
    algorithmField.root,
    digitsField.root,
    periodField.root,
    noteField.root
  );

  const syncDetails = (): void => {
    issuerField.set(draft.issuer);
    accountField.set(draft.account);
    labelField.set(draft.label);
    algorithmField.set(draft.algorithm);
    digitsField.set(String(draft.digits));
    periodField.set(String(draft.period));
    noteField.set(draft.note);
  };

  /* ---------------- the pairing picture ---------------- */

  const pairing = el('div', { className: 'authenticator-pairing' });
  const pairingFigure = el('div', { className: 'authenticator-pairing__figure' });
  const pairingFacts = el('div', { className: 'authenticator-pairing__facts' });
  const secretDisplay = el('p', {
    className: 'authenticator-pairing__secret md-typescale-body-large',
    attrs: { 'data-testid': 'authenticator-secret' }
  });
  let secretVisible = false;

  const revealButton = ctx.components.button({
    label: 'authenticator.pair.showSecret',
    variant: 'outlined',
    icon: 'visibility',
    onClick: () => {
      secretVisible = !secretVisible;
      revealButton.querySelector('.md-btn__label')!.textContent = ctx.t(
        secretVisible ? 'authenticator.pair.hideSecret' : 'authenticator.pair.showSecret',
        secretVisible ? 'Hide the secret' : 'Show the secret'
      );
      refreshPairing();
    }
  });

  const copySecretButton = ctx.components.button({
    label: 'authenticator.pair.copySecret',
    variant: 'text',
    icon: 'copy',
    onClick: () => void copyText(ctx, draft.secret, ctx.t('authenticator.pair.copySecret', 'Copy the secret'))
  });

  const copyUriButton = ctx.components.button({
    label: 'authenticator.pair.copyUri',
    variant: 'text',
    icon: 'copy',
    onClick: () => void copyText(ctx, buildPairingUri(draft), ctx.t('authenticator.pair.copyUri', 'Copy the pairing link'))
  });

  function refreshPairing(): void {
    pairingFigure.textContent = '';
    pairingFacts.textContent = '';
    if (draft.secret === '') {
      pairing.hidden = true;
      return;
    }
    pairing.hidden = false;

    const uri = buildPairingUri(draft);
    const description = ctx.t(
      'authenticator.pair.qrAlt',
      'Pairing code for {account} at {issuer}. Scan it with an authenticator, or use the written secret beside it.',
      {
        values: {
          account: draft.account || ctx.t('authenticator.add.account', 'Account'),
          issuer: draft.issuer || ctx.t('authenticator.add.issuer', 'Issuer')
        }
      }
    );

    try {
      const moduleSize = Math.max(3, Math.min(12, ctx.settings.get<number>(QR_MODULE_SIZE_ID, 6)));
      const code = encodeQr(uri, { level: 'M' });
      pairingFigure.append(qrToSvg(code, { moduleSize, description }));
      pairingFacts.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('authenticator.pair.levelUsed', 'Drawn as a version {version} code at error correction level {level}.', {
            values: { version: code.version, level: code.level }
          })
        })
      );
    } catch (error) {
      pairingFigure.append(
        el('p', {
          className: 'authenticator-register__status--error md-typescale-body-small',
          text: error instanceof Error ? error.message : String(error)
        })
      );
    }

    const written = groupSecret(draft.secret);
    secretDisplay.textContent = secretVisible ? written : written.replace(/[^ ]/g, '•');
    secretDisplay.setAttribute(
      'aria-label',
      secretVisible
        ? `${ctx.t('authenticator.pair.secretLabel', 'The same secret, written out')}: ${written}`
        : ctx.t('authenticator.pair.showSecret', 'Show the secret')
    );

    pairingFacts.append(
      el('p', { className: 'md-typescale-body-small', text: ctx.t('authenticator.pair.drawnHere', 'This picture is drawn on this computer. It is never sent anywhere, because it contains the secret.') }),
      el('p', {
        className: 'md-typescale-label-medium',
        text: ctx.t('authenticator.pair.secretLabel', 'The same secret, written out')
      }),
      secretDisplay,
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t('authenticator.pair.parameters', 'Algorithm {algorithm}, {digits} digits, {period} second period.', {
          values: { algorithm: draft.algorithm, digits: draft.digits, period: draft.period }
        })
      }),
      el('p', { className: 'md-typescale-body-small', text: ctx.t('authenticator.pair.whyWritten', 'A picture is no use to somebody who cannot see it.') })
    );

    const actions = el('div', { className: 'authenticator-pairing__actions' });
    actions.append(revealButton, copySecretButton, copyUriButton);
    pairingFacts.append(actions);
  }

  pairing.append(pairingFigure, pairingFacts);
  pairing.hidden = true;

  /* ---------------- routes ---------------- */

  function drawRoute(): void {
    routeBody.textContent = '';
    say('');
    if (route === 'generate') drawGenerate();
    else if (route === 'uri') drawUri();
    else if (route === 'image') drawImage();
    else if (route === 'camera') void drawCamera();
    else drawManual();
    syncDetails();
    refreshPairing();
    refreshSaveState();
  }

  function drawGenerate(): void {
    if (!draft.generated || draft.secret === '') {
      draft.secret = generateSecret();
      draft.generated = true;
      draft.algorithm = readAlgorithm(ctx);
      draft.digits = readDigits(ctx);
      draft.period = readPeriod(ctx);
    }
    routeBody.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t('authenticator.pair.title', 'Pair your other authenticator')
      }),
      ctx.components.button({
        label: 'authenticator.add.regenerate',
        variant: 'text',
        icon: 'refresh',
        onClick: () => {
          draft.secret = generateSecret();
          secretVisible = false;
          refreshPairing();
        }
      })
    );
  }

  function drawUri(): void {
    const field = ctx.components.textField({
      label: 'authenticator.add.uri',
      supportingText: 'authenticator.add.uri.hint',
      multiline: true,
      rows: 3,
      onCommit: (value) => applyUri(value)
    });
    const paste = ctx.components.button({
      label: 'authenticator.add.paste',
      variant: 'tonal',
      icon: 'copy',
      onClick: async () => {
        try {
          const text = await navigator.clipboard.readText();
          field.set(text);
          applyUri(text);
        } catch (error) {
          say(
            ctx.t('authenticator.error.clipboardText', 'Nothing could be read from the clipboard: {reason}', {
              values: { reason: error instanceof Error ? error.message : String(error) }
            }),
            'error'
          );
        }
      }
    });
    routeBody.append(field.root, paste);
  }

  function applyUri(text: string): void {
    if (text.trim() === '') return;
    try {
      const parsed = parsePairingUri(text);
      Object.assign(draft, parsed, { generated: false });
      if (draft.label === '') draft.label = parsed.issuer || parsed.account;
      syncDetails();
      refreshPairing();
      refreshSaveState();
      say(
        ctx.t('authenticator.pair.parameters', 'Algorithm {algorithm}, {digits} digits, {period} second period.', {
          values: { algorithm: parsed.algorithm, digits: parsed.digits, period: parsed.period }
        })
      );
    } catch (error) {
      say(error instanceof PairingUriError ? error.message : String(error), 'error');
    }
  }

  function drawImage(): void {
    const choose = ctx.components.button({
      label: 'authenticator.add.chooseImage',
      variant: 'tonal',
      icon: 'file',
      onClick: () => void readFromFile()
    });
    const fromClipboard = ctx.components.button({
      label: 'authenticator.add.pasteImage',
      variant: 'text',
      icon: 'copy',
      onClick: () => void readFromClipboardImage()
    });
    const drop = el('div', {
      className: 'authenticator-register__drop',
      text: ctx.t('authenticator.add.route.image', 'Read a picture of a code'),
      attrs: { tabindex: '0', role: 'button', 'aria-label': ctx.t('authenticator.add.chooseImage', 'Choose a picture…') }
    });
    drop.addEventListener('click', () => void readFromFile());
    drop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void readFromFile();
      }
    });
    drop.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('authenticator-register__drop--over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('authenticator-register__drop--over'));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('authenticator-register__drop--over');
      const file = event.dataTransfer?.files?.[0];
      if (file) void readFromBlob(file);
    });
    routeBody.append(drop, choose, fromClipboard);
  }

  async function readFromFile(): Promise<void> {
    const picked = await ctx.studio.dialog.openFile({
      title: ctx.t('authenticator.add.chooseImage', 'Choose a picture…'),
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }]
    });
    if (!picked.ok || !picked.value || picked.value.length === 0) return;
    const path = picked.value[0];
    const stat = await ctx.studio.fs.stat(path);
    if (stat.ok && stat.value.size > LIMITS.maxImageBytes) {
      say(
        ctx.t('authenticator.error.tooLarge', 'That picture is {size} and the limit is {limit}. Crop it and try again.', {
          values: { size: formatBytes(stat.value.size), limit: formatBytes(LIMITS.maxImageBytes) }
        }),
        'error'
      );
      return;
    }
    const read = await ctx.studio.fs.readBase64(path, LIMITS.maxImageBytes);
    if (!read.ok) {
      say(read.error, 'error');
      return;
    }
    await readFromBlob(base64ToBlob(read.value));
  }

  async function readFromClipboardImage(): Promise<void> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((candidate) => candidate.startsWith('image/'));
        if (!type) continue;
        await readFromBlob(await item.getType(type));
        return;
      }
      say(ctx.t('authenticator.error.clipboardImage', 'No picture was found on the clipboard.'), 'error');
    } catch (error) {
      say(
        ctx.t('authenticator.error.clipboardText', 'Nothing could be read from the clipboard: {reason}', {
          values: { reason: error instanceof Error ? error.message : String(error) }
        }),
        'error'
      );
    }
  }

  async function readFromBlob(blob: Blob): Promise<void> {
    if (blob.size > LIMITS.maxImageBytes) {
      say(
        ctx.t('authenticator.error.tooLarge', 'That picture is {size} and the limit is {limit}. Crop it and try again.', {
          values: { size: formatBytes(blob.size), limit: formatBytes(LIMITS.maxImageBytes) }
        }),
        'error'
      );
      return;
    }
    say(ctx.t('authenticator.add.scanning', 'Looking for a code…'));
    try {
      const result = await decodeBlob(blob);
      acceptScannedText(result.text, result.version, result.level);
    } catch (error) {
      say(error instanceof QrReadError ? error.message : String(error), 'error');
    }
  }

  function acceptScannedText(text: string, version: number, level: string): void {
    try {
      const parsed = parsePairingUri(text);
      Object.assign(draft, parsed, { generated: false });
      if (draft.label === '') draft.label = parsed.issuer || parsed.account;
      syncDetails();
      refreshPairing();
      refreshSaveState();
      say(
        ctx.t('authenticator.add.readOk', 'Read a version {version} code at error correction level {level}.', {
          values: { version, level }
        })
      );
    } catch (error) {
      say(error instanceof PairingUriError ? error.message : String(error), 'error');
    }
  }

  async function drawCamera(): Promise<void> {
    const holder = el('div', { className: 'authenticator-register__camera' });
    routeBody.append(holder);

    let devices: MediaDeviceInfo[] = [];
    try {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
    } catch {
      devices = [];
    }
    if (devices.length === 0) {
      // The control is not offered as something that will work and then fail:
      // there is no camera, so it says so and points at the routes that do work.
      holder.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t(
            'authenticator.add.noCamera',
            'No camera was found on this computer, so scanning is not available. The other routes all work.'
          )
        })
      );
      return;
    }

    const video = el('video', { className: 'authenticator-register__video' });
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('aria-label', ctx.t('authenticator.add.cameras', 'Camera'));
    const canvas = document.createElement('canvas');

    const start = ctx.components.button({
      label: 'authenticator.add.startCamera',
      variant: 'tonal',
      icon: 'play',
      onClick: async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          video.srcObject = stream;
          await video.play();
          say(ctx.t('authenticator.add.scanning', 'Looking for a code…'));
          const timer = window.setInterval(() => {
            if (video.videoWidth === 0) return;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;
            context.drawImage(video, 0, 0);
            try {
              const result = decodeImageData(context.getImageData(0, 0, canvas.width, canvas.height));
              stopCamera?.();
              stopCamera = null;
              acceptScannedText(result.text, result.version, result.level);
            } catch {
              // A frame without a readable code is the ordinary case, not an
              // error worth reporting on every tick.
            }
          }, 350);
          stopCamera = () => {
            window.clearInterval(timer);
            for (const track of stream.getTracks()) track.stop();
            video.srcObject = null;
          };
        } catch (error) {
          say(
            ctx.t('authenticator.add.cameraRefused', 'The camera was not made available: {reason}', {
              values: { reason: error instanceof Error ? error.message : String(error) }
            }),
            'error'
          );
        }
      }
    });
    const stop = ctx.components.button({
      label: 'authenticator.add.stopCamera',
      variant: 'text',
      icon: 'stop',
      onClick: () => {
        stopCamera?.();
        stopCamera = null;
      }
    });

    holder.append(video, start, stop);
  }

  function drawManual(): void {
    const field = ctx.components.textField({
      label: 'authenticator.add.secret',
      value: draft.generated ? '' : draft.secret,
      onCommit: (value) => {
        try {
          draft.secret = normalizeSecret(value);
          draft.generated = false;
          field.set(groupSecret(draft.secret));
          refreshPairing();
          refreshSaveState();
          say('');
        } catch (error) {
          draft.secret = '';
          refreshPairing();
          refreshSaveState();
          say(error instanceof Error ? error.message : String(error), 'error');
        }
      }
    });
    routeBody.append(field.root);
  }

  /* ---------------- the pairing check ---------------- */

  const confirmHost = el('div', { className: 'authenticator-register__confirm' });
  const codeField = ctx.components.textField({
    label: 'authenticator.confirm.field',
    type: 'text',
    onCommit: () => void attemptSave(false)
  });
  codeField.root.querySelector('input')?.setAttribute('inputmode', 'numeric');
  codeField.root.querySelector('input')?.setAttribute('autocomplete', 'one-time-code');

  const checkButton = ctx.components.button({
    label: 'authenticator.confirm.check',
    variant: 'filled',
    icon: 'check',
    onClick: () => void attemptSave(false)
  });

  const skipButton = ctx.components.button({
    label: 'authenticator.confirm.skip',
    variant: 'text',
    onClick: () => void attemptSave(true)
  });

  confirmHost.append(
    ctx.components.sectionHeading({
      title: 'authenticator.confirm.title',
      description: 'authenticator.confirm.body'
    }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'authenticator.confirm.body',
        'Type the code your authenticator is showing now. Only a match completes the registration.'
      )
    }),
    codeField.root,
    checkButton,
    skipButton,
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('authenticator.confirm.skipExplain', 'The entry is saved and marked as not checked.')
    })
  );

  function refreshSaveState(): void {
    const ready = draft.secret !== '';
    checkButton.disabled = !ready;
    skipButton.disabled = !ready || draft.generated;
    codeField.setDisabled(!ready, ctx.t('authenticator.add.secret', 'Secret in base32'));
    if (draft.generated) {
      skipButton.title = ctx.t(
        'authenticator.confirm.generatedRequired',
        'A secret created here has not been paired with anything yet, so a matching code is the only proof the pairing worked.'
      );
      skipButton.setAttribute('aria-disabled', 'true');
    } else {
      skipButton.removeAttribute('aria-disabled');
      skipButton.title = '';
    }
    if (!ready) {
      checkButton.title = ctx.t('authenticator.add.secret', 'Secret in base32');
    } else {
      checkButton.title = '';
    }
  }

  async function attemptSave(skipCheck: boolean): Promise<void> {
    if (draft.secret === '') return;

    const validation = validateEntryFields({
      issuer: draft.issuer,
      account: draft.account,
      label: draft.label || draft.issuer,
      digits: draft.digits,
      period: draft.period
    });
    if (validation) {
      say(validation, 'error');
      return;
    }

    if (skipCheck && draft.generated) {
      say(
        ctx.t(
          'authenticator.confirm.generatedRequired',
          'A secret created here has not been paired with anything yet, so a matching code is the only proof the pairing worked.'
        ),
        'error'
      );
      return;
    }

    if (!skipCheck) {
      const typed = codeField.get().replace(/\s+/g, '');
      if (typed === '') {
        say(ctx.t('authenticator.confirm.field', 'Code from your authenticator'), 'error');
        return;
      }
      const matched = await verifyTotp(
        { secret: draft.secret, algorithm: draft.algorithm, digits: draft.digits, period: draft.period },
        typed,
        1,
        correctedNow(ctx)
      );
      if (!matched) {
        say(
          ctx.t(
            'authenticator.confirm.mismatch',
            'That code does not match. Nothing has been saved. Check the secret, and check that both clocks agree.'
          ),
          'error'
        );
        return;
      }
    }

    const duplicate = store()
      .entries()
      .find((candidate) => candidate.issuer === draft.issuer && candidate.account === draft.account);
    if (duplicate) {
      const proceed = await ctx.components.dialog({
        title: ctx.t('authenticator.error.duplicate', 'An entry for {account} at {issuer} already exists.', {
          values: { account: draft.account, issuer: draft.issuer },
          dialog: true
        }),
        confirmLabel: ctx.t('authenticator.error.addAnyway', 'Add a second one anyway'),
        cancelLabel: ctx.t('core.action.cancel', 'Cancel')
      });
      if (!proceed) return;
    }

    const entry: AuthenticatorEntry = {
      id: newEntryId(),
      issuer: draft.issuer,
      account: draft.account,
      label: draft.label || draft.issuer || draft.account,
      icon: draft.icon,
      group: draft.group,
      order: store().entries().length,
      algorithm: draft.algorithm,
      digits: draft.digits,
      period: draft.period,
      createdAt: new Date().toISOString(),
      verified: !skipCheck,
      note: draft.note
    };

    try {
      await store().add(entry, draft.secret);
    } catch (error) {
      say(error instanceof Error ? error.message : String(error), 'error');
      return;
    }

    ctx.notify.success(
      ctx.t('authenticator.confirm.matched', 'That matched. The entry has been saved.', { dialog: true }),
      `${entry.label} — ${entry.account}`
    );
    stopCamera?.();
    overlay.close();
    onSaved(entry);
  }

  /* ---------------- assembly ---------------- */

  body.append(routeHost, routeBody, details, pairing, confirmHost, status);
  drawRoute();

  window.requestAnimationFrame(() => ctx.a11y.focusVisible(routePicker.root));
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function readAlgorithm(ctx: AppContext): Draft['algorithm'] {
  const stored = ctx.settings.get<string>(DEFAULT_ALGORITHM_ID, DEFAULTS.algorithm);
  return (ALGORITHMS.find((candidate) => candidate === stored) ?? DEFAULTS.algorithm) as Draft['algorithm'];
}

export function readDigits(ctx: AppContext): number {
  const stored = Number(ctx.settings.get<number>(DEFAULT_DIGITS_ID, DEFAULTS.digits));
  return Number.isInteger(stored) && stored >= LIMITS.minDigits && stored <= LIMITS.maxDigits ? stored : DEFAULTS.digits;
}

export function readPeriod(ctx: AppContext): number {
  const stored = Number(ctx.settings.get<number>(DEFAULT_PERIOD_ID, DEFAULTS.period));
  return Number.isInteger(stored) && stored >= LIMITS.minPeriod && stored <= LIMITS.maxPeriod ? stored : DEFAULTS.period;
}

export async function copyText(ctx: AppContext, text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ctx.a11y.announce(`${what}: ${ctx.t('core.action.copy', 'Copy')}`);
  } catch (error) {
    ctx.notify.error(
      ctx.t('authenticator.error.title', 'That did not work', { dialog: true }),
      error instanceof Error ? error.message : String(error)
    );
  }
}

function base64ToBlob(base64: string): Blob {
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes]);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
