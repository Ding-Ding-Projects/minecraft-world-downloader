import { DEFAULTS, readConfig, validateConfig, writeConfig } from './config.js';

const fields = {
  enabled: document.getElementById('enabled'),
  endpoint: document.getElementById('endpoint'),
  token: document.getElementById('token'),
  minimumBytes: document.getElementById('minimum-bytes'),
  onlyTheseExtensions: document.getElementById('only-extensions'),
  neverTheseExtensions: document.getElementById('never-extensions'),
  keepBrowserDownloadOnFailure: document.getElementById('keep-on-failure')
};

const errorNodes = {
  endpoint: document.getElementById('endpoint-error'),
  token: document.getElementById('token-error'),
  minimumBytes: document.getElementById('minimum-error')
};

const statusNode = document.getElementById('status');
const showToken = document.getElementById('show-token');

function setStatus(message, tone) {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone;
}

function collect() {
  return {
    enabled: fields.enabled.checked,
    endpoint: fields.endpoint.value.trim().replace(/\/+$/, ''),
    token: fields.token.value.trim(),
    minimumBytes: Number(fields.minimumBytes.value || 0),
    onlyTheseExtensions: fields.onlyTheseExtensions.value.trim(),
    neverTheseExtensions: fields.neverTheseExtensions.value.trim(),
    keepBrowserDownloadOnFailure: fields.keepBrowserDownloadOnFailure.checked
  };
}

function showErrors(errors) {
  for (const [key, node] of Object.entries(errorNodes)) {
    const message = errors[key] ?? '';
    node.textContent = message;
    const input = fields[key];
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
}

async function load() {
  const config = await readConfig();
  fields.enabled.checked = Boolean(config.enabled);
  fields.endpoint.value = config.endpoint || DEFAULTS.endpoint;
  fields.token.value = config.token || '';
  fields.minimumBytes.value = String(config.minimumBytes ?? 0);
  fields.onlyTheseExtensions.value = config.onlyTheseExtensions || '';
  fields.neverTheseExtensions.value = config.neverTheseExtensions || '';
  fields.keepBrowserDownloadOnFailure.checked = config.keepBrowserDownloadOnFailure !== false;
  setStatus(
    config.token
      ? 'Settings loaded. A pairing token is stored in this browser profile.'
      : 'Settings loaded. No pairing token is stored yet, so capture stays off.',
    'neutral'
  );
}

showToken.addEventListener('change', () => {
  fields.token.type = showToken.checked ? 'text' : 'password';
});

document.getElementById('settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const candidate = collect();
  const errors = validateConfig(candidate);
  showErrors(errors);
  const first = Object.keys(errors)[0];
  if (first) {
    fields[first]?.focus();
    setStatus('Nothing was saved. Correct the field marked above and save again.', 'error');
    return;
  }
  await writeConfig(candidate);
  setStatus(
    candidate.enabled
      ? 'Saved. New downloads matching your rules are handed to the application from now on.'
      : 'Saved. Capture is off, so the browser keeps downloading everything itself.',
    'success'
  );
});

document.getElementById('test').addEventListener('click', async () => {
  const candidate = collect();
  const errors = validateConfig({ ...candidate, enabled: true });
  showErrors(errors);
  const first = Object.keys(errors)[0];
  if (first) {
    fields[first]?.focus();
    setStatus('The connection was not tried: fix the field marked above first.', 'error');
    return;
  }
  setStatus(`Asking ${candidate.endpoint} whether it is listening.`, 'neutral');
  const answer = await chrome.runtime.sendMessage({ kind: 'check-connection', config: candidate });
  if (!answer || !answer.ok) {
    setStatus(
      `No usable answer. ${answer && answer.error ? answer.error : 'The receiver did not reply.'}`,
      'error'
    );
    return;
  }
  setStatus(
    `Connected to ${answer.value.product} (protocol ${answer.value.protocol}). ${answer.value.queued} capture(s) are waiting in the application.`,
    'success'
  );
});

void load();
