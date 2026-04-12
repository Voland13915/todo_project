<script>
  import { onMount } from 'svelte'

  // ── Config ────────────────────────────────────────────────────────────────
  const API = (window.location.hostname === 'localhost')
    ? 'http://localhost:4000'
    : `${window.location.protocol}//${window.location.hostname}:4000`

  // ── State ─────────────────────────────────────────────────────────────────
  let todos = []
  let filter = 'all'
  let toast = null
  let toastTimer = null

  // Add form
  let createTitle = ''
  let createDesc  = ''

  // Inline edit
  let editingId   = null
  let editTitle   = ''
  let editDesc    = ''

  // Detail modal
  let detailTask  = null

  // Email modal
  let emailTask   = null
  let emailTo     = ''
  let emailStatus = ''
  let emailColor  = ''

  // ── Computed ──────────────────────────────────────────────────────────────
  $: visibleTodos = filter === 'done'
    ? todos.filter(t => t.completed)
    : filter === 'active'
      ? todos.filter(t => !t.completed)
      : todos

  $: doneCount  = todos.filter(t => t.completed).length
  $: totalCount = todos.length

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const getTodos = async () => {
    try {
      const res = await fetch(`${API}/tasks`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      todos = await res.json()
    } catch (e) {
      showToast('Failed to load tasks: ' + e.message)
    }
  }

  onMount(() => getTodos())

  // ── Create ────────────────────────────────────────────────────────────────
  const createTodo = async (e) => {
    e.preventDefault()
    if (!createTitle.trim()) { showToast('Title is required'); return }
    try {
      await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: createTitle.trim(), description: createDesc.trim() })
      })
      createTitle = ''
      createDesc  = ''
      getTodos()
      showToast('Task added')
    } catch (e) {
      showToast('Error: ' + e.message)
    }
  }

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggleDone = async (todo) => {
    await fetch(`${API}/tasks/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: todo.title, description: todo.description, completed: !todo.completed })
    })
    getTodos()
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  const startEdit = (todo) => {
    editingId = todo.id
    editTitle = todo.title
    editDesc  = todo.description || ''
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editTitle.trim()) { showToast('Title cannot be empty'); return }
    const t = todos.find(t => t.id === editingId)
    await fetch(`${API}/tasks/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim(), description: editDesc.trim(), completed: t.completed })
    })
    editingId = null
    getTodos()
    showToast('Saved')
  }

  const cancelEdit = () => { editingId = null }

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteTodo = async (todo) => {
    await fetch(`${API}/tasks/${todo.id}`, { method: 'DELETE' })
    getTodos()
    showToast('Deleted')
  }

  // ── Detail ────────────────────────────────────────────────────────────────
  const openDetail = (todo) => { detailTask = todo }
  const closeDetail = (e) => {
    if (!e || e.target.classList.contains('overlay')) detailTask = null
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  const openEmail = (todo) => {
    emailTask   = todo
    emailTo     = ''
    emailStatus = ''
    emailColor  = ''
  }

  const closeEmail = (e) => {
    if (!e || e.target.classList.contains('overlay')) emailTask = null
  }

  const sendEmail = async (e) => {
    e.preventDefault()
    if (!emailTo.trim()) { showToast('Enter a recipient'); return }
    emailStatus = 'Sending…'
    emailColor  = '#6b7280'
    try {
      const res  = await fetch(`${API}/tasks/${emailTask.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim() })
      })
      const json = await res.json()
      if (json.success) {
        emailStatus = '✓ Sent successfully!'
        emailColor  = '#16a34a'
        setTimeout(() => { emailTask = null }, 1500)
      } else {
        emailStatus = '✗ ' + (json.error || 'Unknown error')
        emailColor  = '#dc2626'
      }
    } catch {
      emailStatus = '✗ Network error'
      emailColor  = '#dc2626'
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    toast = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast = null }, 2800)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })

  // ── IMAP / POP3 ───────────────────────────────────────────────────────────
  let imapResult  = null
  let imapLoading = false
  let imapError   = ''

  let pop3Result  = null
  let pop3Loading = false
  let pop3Error   = ''

  const checkImap = async () => {
    imapLoading = true; imapError = ''; imapResult = null
    try {
      const res  = await fetch(`${API}/email/imap`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      imapResult = json
    } catch (e) {
      imapError = e.message
    } finally {
      imapLoading = false
    }
  }

  const checkPop3 = async () => {
    pop3Loading = true; pop3Error = ''; pop3Result = null
    try {
      const res  = await fetch(`${API}/email/pop3`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      pop3Result = json
    } catch (e) {
      pop3Error = e.message
    } finally {
      pop3Loading = false
    }
  }
</script>

<!-- ── Topbar ─────────────────────────────────────────────────────────────── -->
<nav class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <div class="brand-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M4 10V4l3 3 3-3v6" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="brand-name">Tasks</span>
    </div>
    <div class="topbar-right">
      <span class="chip">{totalCount} tasks</span>
      <span class="chip chip-green">{doneCount} done</span>
    </div>
  </div>
</nav>

<!-- ── Main ──────────────────────────────────────────────────────────────── -->
<main class="main">
  <header class="page-head">
    <h1>My Tasks</h1>
    <p class="page-sub">Track and manage your work</p>
  </header>

  <!-- Add Form -->
  <section class="add-section">
    <form class="add-row" on:submit={createTodo}>
      <input class="inp inp-main" type="text" bind:value={createTitle} placeholder="New task title..." autocomplete="off"/>
      <input class="inp inp-sub"  type="text" bind:value={createDesc}  placeholder="Description..." autocomplete="off"/>
      <button class="btn-primary" type="submit">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        Add
      </button>
    </form>
  </section>

  <!-- List Section -->
  <section class="list-section">
    <div class="list-toolbar">
      <div class="pills">
        <button class="pill" class:active={filter==='all'}    on:click={() => filter='all'}>All</button>
        <button class="pill" class:active={filter==='active'} on:click={() => filter='active'}>Active</button>
        <button class="pill" class:active={filter==='done'}   on:click={() => filter='done'}>Completed</button>
      </div>
      {#if visibleTodos.length !== totalCount}
        <span class="filter-label">{visibleTodos.length} of {totalCount}</span>
      {/if}
    </div>

    <div class="task-grid">
      <div class="grid-head">
        <span></span>
        <span>Task</span>
        <span>Status</span>
        <span>Date</span>
        <span>Actions</span>
      </div>

      {#each visibleTodos as todo (todo.id)}
        <div class="task-row" class:done-row={todo.completed}>

          <!-- Checkbox -->
          <span>
            <input type="checkbox" class="task-check" checked={todo.completed}
              on:change={() => toggleDone(todo)}/>
          </span>

          <!-- Body / Inline edit -->
          <div class="task-body">
            {#if editingId === todo.id}
              <form on:submit={saveEdit}>
                <input class="edit-inp" bind:value={editTitle} placeholder="Title" autocomplete="off"/>
                <input class="edit-inp" bind:value={editDesc}  placeholder="Description" autocomplete="off" style="margin-top:.3rem"/>
              </form>
            {:else}
              <div class="task-name" class:done-text={todo.completed}>
                <span class="task-id-badge">#{todo.id}</span>{todo.title}
              </div>
              {#if todo.description}
                <div class="task-desc-preview">{todo.description}</div>
              {/if}
            {/if}
          </div>

          <!-- Status -->
          <span>
            <span class="status-badge" class:status-done={todo.completed} class:status-active={!todo.completed}>
              {todo.completed ? 'Done' : 'Active'}
            </span>
          </span>

          <!-- Date -->
          <span class="task-date">{fmt(todo.created_at)}</span>

          <!-- Actions -->
          <div class="task-actions">
            {#if editingId === todo.id}
              <button class="act-btn act-save" on:click={saveEdit}>Save</button>
              <button class="act-btn" on:click={cancelEdit}>Cancel</button>
            {:else}
              <button class="act-btn" on:click={() => openDetail(todo)} title="View">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="2.2" stroke="currentColor" stroke-width="1.3"/><path d="M1 6s1.8-4 5-4 5 4 5 4-1.8 4-5 4-5-4-5-4z" stroke="currentColor" stroke-width="1.3"/></svg>
                View
              </button>
              <button class="act-btn act-edit" on:click={() => startEdit(todo)} title="Edit">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                Edit
              </button>
              <button class="act-btn act-mail" on:click={() => openEmail(todo)} title="Send email">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 4l5 3.5L11 4" stroke="currentColor" stroke-width="1.3"/></svg>
                Email
              </button>
              <button class="act-btn act-del" on:click={() => deleteTodo(todo)} title="Delete">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3v7h4V3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="3" stroke="#9ca3af" stroke-width="1.5"/><path d="M8 8h8M8 12h5" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>No tasks found</span>
        </div>
      {/each}
    </div>
  </section>

  <!-- ── Email Protocols ───────────────────────────────────────────────────── -->
  <section class="proto-section">
    <header class="proto-head">
      <h2>Email Protocols</h2>
      <p class="page-sub">Check incoming mail via IMAP and POP3</p>
    </header>

    <div class="proto-grid">

      <!-- IMAP Card -->
      <div class="proto-card">
        <div class="proto-card-top">
          <div class="proto-icon proto-icon-imap">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="10" rx="2" stroke="#fff" stroke-width="1.3"/>
              <path d="M1 5l6 4 6-4" stroke="#fff" stroke-width="1.3"/>
            </svg>
          </div>
          <div>
            <div class="proto-title">IMAP</div>
            <div class="proto-sub">Internet Message Access Protocol · port 993</div>
          </div>
        </div>
        <p class="proto-desc">Reads messages directly on the server without downloading. Supports folders and flags.</p>
        <button class="btn-proto" on:click={checkImap} disabled={imapLoading}>
          {#if imapLoading}Connecting…{:else}Check IMAP inbox{/if}
        </button>
        {#if imapError}
          <div class="proto-result proto-result-err">
            <span class="dot dot-red"></span>{imapError}
          </div>
        {/if}
        {#if imapResult}
          <div class="proto-result proto-result-ok">
            <span class="dot dot-green"></span>
            Connected · {imapResult.count} message{imapResult.count !== 1 ? 's' : ''} found
          </div>
          {#if imapResult.messages && imapResult.messages.length}
            <ul class="msg-list">
              {#each imapResult.messages as m}
                <li class="msg-item">
                  <span class="msg-from">{(m.header?.from?.[0] || 'Unknown').slice(0, 48)}</span>
                  <span class="msg-subj">{(m.header?.subject?.[0] || '(no subject)').slice(0, 60)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>

      <!-- POP3 Card -->
      <div class="proto-card">
        <div class="proto-card-top">
          <div class="proto-icon proto-icon-pop3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="10" rx="2" stroke="#fff" stroke-width="1.3"/>
              <path d="M4 7h6M7 4v6" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="proto-title">POP3</div>
            <div class="proto-sub">Post Office Protocol v3 · port 995</div>
          </div>
        </div>
        <p class="proto-desc">Downloads messages from the server to a local client. Simple, stateless protocol.</p>
        <button class="btn-proto" on:click={checkPop3} disabled={pop3Loading}>
          {#if pop3Loading}Connecting…{:else}Check POP3 mailbox{/if}
        </button>
        {#if pop3Error}
          <div class="proto-result proto-result-err">
            <span class="dot dot-red"></span>{pop3Error}
          </div>
        {/if}
        {#if pop3Result}
          <div class="proto-result proto-result-ok">
            <span class="dot dot-green"></span>
            Connected · {pop3Result.messageCount} message{pop3Result.messageCount !== 1 ? 's' : ''} in mailbox
          </div>
        {/if}
      </div>

    </div>
  </section>
</main>

<!-- ── Detail Modal ───────────────────────────────────────────────────────── -->
{#if detailTask}
  <div class="overlay" on:click={closeDetail} role="dialog" aria-modal="true">
    <div class="dialog">
      <button class="dialog-close" on:click={() => detailTask = null}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <span class="badge" class:badge-done={detailTask.completed} class:badge-active={!detailTask.completed}>
        {detailTask.completed ? '✓ Done' : '● Active'}
      </span>
      <h2 class="dialog-title">{detailTask.title}</h2>
      <p class="dialog-desc">{detailTask.description || 'No description provided.'}</p>
      <div class="dialog-footer">
        <span class="mono-sm">#{detailTask.id}</span>
        <span class="meta-date">{fmt(detailTask.created_at)}</span>
      </div>
    </div>
  </div>
{/if}

<!-- ── Email Modal ────────────────────────────────────────────────────────── -->
{#if emailTask}
  <div class="overlay" on:click={closeEmail} role="dialog" aria-modal="true">
    <div class="dialog">
      <button class="dialog-close" on:click={() => emailTask = null}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <h2 class="dialog-title">Send task by email</h2>
      <p class="email-label">{emailTask.title}</p>
      <form on:submit={sendEmail}>
        <label class="field-label">Recipient address</label>
        <input class="inp" type="email" bind:value={emailTo} placeholder="name@example.com" style="margin-bottom:1rem"/>
        <button class="btn-primary" type="submit" style="width:100%;justify-content:center">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2" width="11" height="9" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M1 4l5.5 4L12 4" stroke="currentColor" stroke-width="1.3"/></svg>
          Send
        </button>
      </form>
      {#if emailStatus}
        <p class="email-status" style="color:{emailColor}">{emailStatus}</p>
      {/if}
    </div>
  </div>
{/if}

<!-- ── Toast ──────────────────────────────────────────────────────────────── -->
{#if toast}
  <div class="toast">{toast}</div>
{/if}

<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :global(body) {
    font-family: 'Inter', system-ui, sans-serif;
    background: #fafafa;
    color: #111827;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Topbar ── */
  .topbar {
    position: sticky; top: 0; z-index: 50;
    background: rgba(255,255,255,.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid #e5e7eb;
  }
  .topbar-inner {
    max-width: 900px; margin: 0 auto; padding: 0 1.5rem;
    height: 52px; display: flex; align-items: center; justify-content: space-between;
  }
  .brand { display: flex; align-items: center; gap: .6rem; }
  .brand-icon {
    width: 26px; height: 26px; background: #000; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand-name { font-weight: 600; font-size: .875rem; letter-spacing: -.01em; }
  .topbar-right { display: flex; gap: .5rem; align-items: center; }
  .chip {
    font-size: .75rem; font-weight: 500; padding: .2rem .6rem;
    border-radius: 20px; background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb;
  }
  .chip-green { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }

  /* ── Main ── */
  .main { max-width: 900px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
  .page-head { margin-bottom: 2rem; }
  h1 { font-size: 1.75rem; font-weight: 600; letter-spacing: -.03em; line-height: 1.2; }
  .page-sub { font-size: .875rem; color: #6b7280; margin-top: .25rem; }

  /* ── Add Section ── */
  .add-section {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 1rem 1.25rem; margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,.08);
  }
  .add-row { display: flex; gap: .75rem; align-items: center; }
  .inp {
    background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px;
    color: #111827; font-family: 'Inter', sans-serif; font-size: .875rem;
    padding: .5rem .75rem; outline: none; transition: border-color .15s, box-shadow .15s; width: 100%;
  }
  .inp:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
  .inp::placeholder { color: #9ca3af; }
  .inp-main { flex: 2; }
  .inp-sub  { flex: 3; }

  .btn-primary {
    display: inline-flex; align-items: center; gap: .4rem;
    background: #000; color: #fff; border: none; border-radius: 6px;
    padding: .5rem 1rem; font-family: 'Inter', sans-serif; font-weight: 500;
    font-size: .875rem; cursor: pointer; white-space: nowrap;
    transition: opacity .15s, transform .1s; flex-shrink: 0;
  }
  .btn-primary:hover  { opacity: .82; }
  .btn-primary:active { transform: scale(.98); }

  /* ── List Section ── */
  .list-section {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08); overflow: hidden;
  }
  .list-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: .75rem 1rem; border-bottom: 1px solid #e5e7eb;
  }
  .pills { display: flex; gap: .375rem; }
  .pill {
    background: transparent; border: 1px solid transparent; border-radius: 6px;
    color: #6b7280; font-family: 'Inter', sans-serif; font-size: .8rem; font-weight: 500;
    padding: .3rem .75rem; cursor: pointer; transition: all .12s;
  }
  .pill:hover { background: #f3f4f6; color: #111827; }
  .pill.active { background: #111827; color: #fff; border-color: #111827; }
  .filter-label { font-size: .75rem; color: #9ca3af; }

  /* ── Grid ── */
  .grid-head {
    display: grid; grid-template-columns: 36px 1fr 100px 90px 200px;
    padding: .5rem 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    font-size: .72rem; font-weight: 600; color: #6b7280;
    text-transform: uppercase; letter-spacing: .05em;
  }
  .task-row {
    display: grid; grid-template-columns: 36px 1fr 100px 90px 200px;
    align-items: center; padding: .65rem 1rem; border-bottom: 1px solid #e5e7eb;
    transition: background .1s; animation: rowIn .2s ease both;
  }

  .task-row:last-child { border-bottom: none; }
  .task-row:hover { background: #f9fafb; }
  .done-row { opacity: .6; }

  @keyframes rowIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .task-check {
    appearance: none; width: 16px; height: 16px;
    border: 1.5px solid #d1d5db; border-radius: 4px; cursor: pointer;
    position: relative; transition: all .12s;
  }
  .task-check:hover { border-color: #2563eb; }
  .task-check:checked { background: #16a34a; border-color: #16a34a; }
  .task-check:checked::after {
    content: ''; position: absolute; left: 3px; top: 0;
    width: 4px; height: 8px; border: 1.5px solid #fff;
    border-top: none; border-left: none; transform: rotate(45deg);
  }

  .task-body { min-width: 0; padding-right: .5rem; }
  .task-name {
    font-size: .875rem; font-weight: 500; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; color: #111827;
  }
  .done-text { text-decoration: line-through; color: #6b7280; font-weight: 400; }
  .task-id-badge {
    font-family: 'JetBrains Mono', monospace; font-size: .68rem; color: #9ca3af;
    background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px;
    padding: .05rem .3rem; margin-right: .35rem;
  }
  .task-desc-preview {
    font-size: .75rem; color: #9ca3af; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; margin-top: .1rem;
  }

  .status-badge {
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .72rem; font-weight: 500; padding: .25rem .6rem; border-radius: 20px;
  }
  .status-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; }
  .status-done   { background: #f0fdf4; color: #15803d; }
  .status-done::before   { background: #16a34a; }
  .status-active { background: #eff6ff; color: #1d4ed8; }
  .status-active::before { background: #2563eb; }

  .task-date { font-size: .75rem; color: #9ca3af; }

  .task-actions { display: flex; gap: .3rem; align-items: center; }
  .act-btn {
    display: inline-flex; align-items: center; gap: .3rem;
    background: transparent; border: 1px solid #e5e7eb; border-radius: 5px;
    padding: .28rem .55rem; font-size: .72rem; font-weight: 500;
    color: #6b7280; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: all .12s; white-space: nowrap;
  }
  .act-btn:hover      { border-color: #d1d5db; color: #111827; background: #f9fafb; }
  .act-edit:hover     { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
  .act-del:hover      { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
  .act-mail:hover     { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }
  .act-save           { border-color: #16a34a; color: #16a34a; }

  .edit-inp {
    background: #fff; border: 1px solid #2563eb; border-radius: 4px;
    color: #111827; font-family: 'Inter', sans-serif; font-size: .8rem;
    padding: .2rem .4rem; outline: none; width: 100%;
    box-shadow: 0 0 0 2px rgba(37,99,235,.1);
  }

  /* ── Empty ── */
  .empty {
    display: flex; flex-direction: column; align-items: center;
    gap: .6rem; padding: 3rem; color: #9ca3af; font-size: .875rem;
  }

  /* ── Overlay / Dialog ── */
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.4);
    backdrop-filter: blur(2px); display: flex; align-items: center;
    justify-content: center; z-index: 100; padding: 1rem;
  }
  .dialog {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
    padding: 1.75rem; width: 100%; max-width: 440px; position: relative;
    box-shadow: 0 4px 24px rgba(0,0,0,.1); animation: rowIn .18s ease;
  }
  .dialog-close {
    position: absolute; top: 1rem; right: 1rem;
    background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 5px;
    width: 26px; height: 26px; display: flex; align-items: center;
    justify-content: center; cursor: pointer; color: #6b7280; transition: all .12s;
  }
  .dialog-close:hover { background: #e5e7eb; color: #111827; }
  .dialog-title {
    font-size: 1.1rem; font-weight: 600; letter-spacing: -.02em;
    margin-bottom: .5rem; margin-top: .5rem;
  }
  .dialog-desc { font-size: .875rem; color: #6b7280; line-height: 1.6; margin-bottom: 1.25rem; }

  .badge {
    display: inline-block; font-size: .7rem; font-weight: 600;
    padding: .2rem .6rem; border-radius: 20px;
  }
  .badge-done   { background: #f0fdf4; color: #15803d; }
  .badge-active { background: #eff6ff; color: #1d4ed8; }

  .dialog-footer {
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid #e5e7eb; padding-top: .75rem;
  }
  .mono-sm { font-family: 'JetBrains Mono', monospace; font-size: .75rem; color: #9ca3af; }
  .meta-date { font-size: .75rem; color: #9ca3af; }

  .email-label {
    font-size: .875rem; font-weight: 500; color: #2563eb;
    margin-bottom: .75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .field-label { display: block; font-size: .75rem; font-weight: 500; color: #6b7280; margin-bottom: .35rem; }
  .email-status { font-size: .8rem; text-align: center; margin-top: .75rem; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 1.5rem; right: 1.5rem;
    background: #111827; color: #fff; border-radius: 8px;
    padding: .6rem 1rem; font-size: .8rem; font-weight: 500;
    box-shadow: 0 4px 24px rgba(0,0,0,.15); animation: rowIn .2s ease; z-index: 200;
  }

  /* ── Email Protocols ── */
  .proto-section {
    margin-top: 2rem;
  }
  .proto-head {
    margin-bottom: 1.25rem;
  }
  .proto-head h2 {
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: -.02em;
  }
  .proto-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 600px) {
    .proto-grid { grid-template-columns: 1fr; }
  }
  .proto-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,.08);
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }
  .proto-card-top {
    display: flex;
    align-items: center;
    gap: .75rem;
  }
  .proto-icon {
    width: 32px; height: 32px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .proto-icon-imap { background: #2563eb; }
  .proto-icon-pop3 { background: #7c3aed; }
  .proto-title { font-size: .875rem; font-weight: 600; color: #111827; }
  .proto-sub   { font-size: .72rem; color: #9ca3af; margin-top: .1rem; }
  .proto-desc  { font-size: .8rem; color: #6b7280; line-height: 1.6; }
  .btn-proto {
    display: block; width: 100%;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
    color: #374151; font-family: 'Inter', sans-serif; font-size: .8rem;
    font-weight: 500; padding: .5rem; cursor: pointer;
    transition: all .12s; text-align: center;
  }
  .btn-proto:hover:not(:disabled) { background: #f3f4f6; border-color: #d1d5db; color: #111827; }
  .btn-proto:disabled { opacity: .55; cursor: not-allowed; }
  .proto-result {
    font-size: .78rem; font-weight: 500; display: flex; align-items: flex-start; gap: .4rem;
    padding: .5rem .75rem; border-radius: 6px; line-height: 1.5;
  }
  .proto-result-ok  { background: #f0fdf4; color: #15803d; }
  .proto-result-err { background: #fef2f2; color: #dc2626; }
  .dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: .25rem;
  }
  .dot-green { background: #16a34a; }
  .dot-red   { background: #dc2626; }
  .msg-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: .25rem;
  }
  .msg-item {
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 5px;
    padding: .35rem .6rem;
    display: flex; flex-direction: column; gap: .1rem;
  }
  .msg-from { font-size: .72rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .msg-subj { font-size: .78rem; color: #111827; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

</style>