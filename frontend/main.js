const API = (window.location.hostname === 'localhost')
    ? 'http://localhost:4000'
    : `${window.location.protocol}//${window.location.hostname}:4000`;

let allTasks = [];
let currentFilter = 'all';
let emailTaskId = null;

// ── Fetch & Render ────────────────────────────────────────────────────────────

async function fetchTasks() {
    try {
        const res = await fetch(`${API}/tasks`);
        allTasks = await res.json();
        renderTasks();
        updateStats();
    } catch (e) {
        showToast('Failed to load tasks', true);
    }
}

function filteredTasks() {
    if (currentFilter === 'done')   return allTasks.filter(t => t.completed);
    if (currentFilter === 'active') return allTasks.filter(t => !t.completed);
    return allTasks;
}

function renderTasks() {
    const list = document.getElementById('task-list');
    const empty = document.getElementById('empty');
    const tasks = filteredTasks();

    if (tasks.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    list.innerHTML = tasks.map(t => `
    <div class="task-row ${t.completed ? 'done' : ''}" id="row-${t.id}">
      <input type="checkbox" class="task-check" ${t.completed ? 'checked' : ''}
        onchange="toggleDone(${t.id}, this.checked)"/>

      <div class="task-body" id="body-${t.id}">
        <div class="task-title ${t.completed ? 'striked' : ''}">
          <span class="task-id">#${t.id}</span>
          <span>${escHtml(t.title)}</span>
        </div>
        ${t.description ? `<div class="task-desc">${escHtml(t.description)}</div>` : ''}
      </div>

      <div class="task-actions" id="actions-${t.id}">
        <button class="btn-icon" onclick="openDetail(${t.id})" title="View">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="btn-icon" onclick="startEdit(${t.id})" title="Edit">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn-icon success" onclick="openEmailModal(${t.id})" title="Send email">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M1 5l7 5 7-5" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteTask(${t.id})" title="Delete">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v9h6V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function updateStats() {
    const done = allTasks.filter(t => t.completed).length;
    document.getElementById('stat-total').textContent = `${allTasks.length} total`;
    document.getElementById('stat-done').textContent = `${done} done`;
}

// ── Add Task ──────────────────────────────────────────────────────────────────

async function addTask() {
    const title = document.getElementById('inp-title').value.trim();
    const description = document.getElementById('inp-desc').value.trim();
    if (!title) { showToast('Title is required'); return; }

    await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
    });

    document.getElementById('inp-title').value = '';
    document.getElementById('inp-desc').value = '';
    fetchTasks();
}

document.getElementById('inp-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
});

// ── Toggle Done ───────────────────────────────────────────────────────────────

async function toggleDone(id, completed) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    await fetch(`${API}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, description: task.description, completed }),
    });
    fetchTasks();
}

// ── Inline Edit ───────────────────────────────────────────────────────────────

function startEdit(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    const body = document.getElementById(`body-${id}`);
    const actions = document.getElementById(`actions-${id}`);

    body.innerHTML = `
    <input class="task-edit-input" id="edit-title-${id}" value="${escHtml(task.title)}" placeholder="Title"/>
    <input class="task-edit-input" style="margin-top:.4rem" id="edit-desc-${id}" value="${escHtml(task.description||'')}" placeholder="Description"/>
  `;

    actions.innerHTML = `
    <button class="btn-icon save" onclick="saveEdit(${id})">Save</button>
    <button class="btn-icon" onclick="fetchTasks()">Cancel</button>
  `;

    document.getElementById(`edit-title-${id}`).focus();
}

async function saveEdit(id) {
    const task = allTasks.find(t => t.id === id);
    const title = document.getElementById(`edit-title-${id}`).value.trim();
    const description = document.getElementById(`edit-desc-${id}`).value.trim();
    if (!title) { showToast('Title cannot be empty'); return; }

    await fetch(`${API}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, completed: task.completed }),
    });
    fetchTasks();
    showToast('Task updated');
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteTask(id) {
    await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
    showToast('Task deleted');
}

// ── Filters ───────────────────────────────────────────────────────────────────

function setFilter(f, btn) {
    currentFilter = f;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTasks();
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function openDetail(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('modal-badge').textContent = task.completed ? '✓ Done' : '● Active';
    document.getElementById('modal-badge').className = 'modal-badge ' + (task.completed ? 'badge-done' : 'badge-active');
    document.getElementById('modal-title').textContent = task.title;
    document.getElementById('modal-desc').textContent = task.description || 'No description.';
    document.getElementById('modal-id').textContent = `ID: ${task.id}`;
    document.getElementById('modal-date').textContent = new Date(task.created_at).toLocaleDateString();

    document.getElementById('modal').classList.remove('hidden');
}

function closeModal(e) {
    if (!e || e.target.id === 'modal') {
        document.getElementById('modal').classList.add('hidden');
    }
}

// ── Email Modal ───────────────────────────────────────────────────────────────

function openEmailModal(id) {
    const task = allTasks.find(t => t.id === id);
    emailTaskId = id;
    document.getElementById('email-task-name').textContent = task.title;
    document.getElementById('email-to').value = '';
    document.getElementById('email-status').textContent = '';
    document.getElementById('email-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('email-to').focus(), 50);
}

function closeEmailModal(e) {
    if (!e || e.target.id === 'email-modal') {
        document.getElementById('email-modal').classList.add('hidden');
    }
}

async function submitSendEmail() {
    const to = document.getElementById('email-to').value.trim();
    if (!to) { showToast('Enter an email address'); return; }

    const status = document.getElementById('email-status');
    status.textContent = 'Sending...';
    status.style.color = 'var(--muted)';

    try {
        const res = await fetch(`${API}/tasks/${emailTaskId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to }),
        });
        const json = await res.json();
        if (json.success) {
            status.textContent = '✓ Sent successfully!';
            status.style.color = 'var(--green)';
            setTimeout(() => closeEmailModal(), 1500);
        } else {
            status.textContent = '✗ Error: ' + (json.error || 'Unknown error');
            status.style.color = 'var(--accent2)';
        }
    } catch (e) {
        status.textContent = '✗ Network error';
        status.style.color = 'var(--accent2)';
    }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
fetchTasks();