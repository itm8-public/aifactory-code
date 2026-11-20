// The chat page. The browser keeps the conversation; the server stores no chat history.
const turns = [];
const $ = (id) => document.getElementById(id);

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: { 'x-requested-with': 'XMLHttpRequest', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Easy Auth answers 401 when the sign-in has expired; reloading signs the user in again.
  if (res.status === 401 && location.hostname !== 'localhost') location.reload();
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? 'Something went wrong.');
  return data;
}

function reply(result) {
  switch (result.status) {
    case 'answered':
      return result.answer;
    case 'blocked':
      return 'The content filter blocked this message or its answer. Rephrase it and try again.';
    case 'try-later':
      return result.reason === 'limit'
        ? `You have reached your hourly limit. Try again in about ${Math.ceil(result.retryAfterSeconds / 60)} minutes.`
        : `The AI service is busy. Try again in ${result.retryAfterSeconds} seconds.`;
    default:
      return 'AI is not configured here. Set the Foundry endpoint and the deployment name in the settings.';
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent: never HTML from the model
  return node;
}

function renderTurns() {
  const list = $('turns');
  list.replaceChildren(
    ...turns.map((t) => {
      const li = el('li', `card ${t.role === 'user' ? 'card--outlined' : 'card--muted'}`);
      li.append(el('p', 'overline', t.role === 'user' ? 'You' : 'Assistant (AI)'), el('p', 'answer', t.content));
      return li;
    }),
  );
}

async function loadActions() {
  const actions = await api('/api/actions');
  $('pending').hidden = actions.length === 0;
  $('actions').replaceChildren(
    ...actions.map((a) => {
      const li = el('li', 'card card--outlined row');
      const approve = el('button', 'btn btn--sm', 'Approve');
      const reject = el('button', 'btn btn--sm btn--secondary', 'Reject');
      approve.type = reject.type = 'button';
      approve.onclick = () => decide(a.id, true);
      reject.onclick = () => decide(a.id, false);
      li.append(el('span', 'grow', a.summary), el('span', 'badge', 'Proposed by AI'), approve, reject);
      return li;
    }),
  );
}

async function decide(id, approve) {
  try {
    await api(`/api/actions/${id}/decision`, { approve });
    await loadActions();
  } catch (err) {
    $('error').textContent = `Error: ${err.message}`;
  }
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = $('message').value.trim();
  if (!content) return;
  $('error').textContent = '';
  turns.push({ role: 'user', content });
  $('message').value = '';
  renderTurns();
  const button = e.submitter;
  button.disabled = true;
  button.textContent = 'Thinking…';
  try {
    const result = await api('/api/chat', { messages: turns.slice(-20) });
    turns.push({ role: 'assistant', content: reply(result) });
    renderTurns();
    await loadActions();
  } catch (err) {
    $('error').textContent = `Error: ${err.message}`;
  } finally {
    button.disabled = false;
    button.textContent = 'Send';
  }
});

api('/api/me')
  .then((me) => ($('user').textContent = me.name))
  .catch(() => ($('user').textContent = 'Not signed in'));
loadActions().catch(() => {});
