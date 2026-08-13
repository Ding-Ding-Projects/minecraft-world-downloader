import { readConfig } from './config.js';

const statusNode = document.getElementById('status');
const recentNode = document.getElementById('recent');

function setStatus(message, tone) {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone;
}

async function refreshStatus() {
  const config = await readConfig();
  if (!config.enabled) {
    setStatus('Capture is off. The browser is downloading everything itself.', 'neutral');
    return;
  }
  if (!config.token) {
    setStatus('Capture is on but no pairing token is stored, so nothing can be handed over.', 'error');
    return;
  }
  setStatus(`Asking ${config.endpoint} whether it is listening.`, 'neutral');
  const answer = await chrome.runtime.sendMessage({ kind: 'check-connection', config });
  if (!answer || !answer.ok) {
    setStatus(
      `Not connected. ${answer && answer.error ? answer.error : 'The receiver did not reply.'}`,
      'error'
    );
    return;
  }
  setStatus(
    `Connected to ${answer.value.product}. ${answer.value.queued} capture(s) are waiting in the application.`,
    'success'
  );
}

async function refreshRecent() {
  const answer = await chrome.runtime.sendMessage({ kind: 'recent' });
  const entries = answer && answer.ok && Array.isArray(answer.value) ? answer.value : [];
  recentNode.textContent = '';
  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'detail';
    empty.textContent = 'Nothing has been captured since the browser last started.';
    recentNode.append(empty);
    return;
  }
  for (const entry of entries) {
    const item = document.createElement('li');
    const outcome = document.createElement('div');
    outcome.className = 'outcome';
    outcome.textContent = `${new Date(entry.at).toLocaleTimeString()} — ${entry.outcome}`;
    const url = document.createElement('div');
    url.textContent = entry.url;
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = entry.detail;
    item.append(outcome, url, detail);
    recentNode.append(item);
  }
}

document.getElementById('recheck').addEventListener('click', () => {
  void refreshStatus();
  void refreshRecent();
});

document.getElementById('open-options').addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

void refreshStatus();
void refreshRecent();
