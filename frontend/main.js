const API = (window.location.hostname === 'localhost') ? 'http://localhost:4000' : `${window.location.protocol}//${window.location.hostname}:4000`;

async function fetchTasks() {
    const res = await fetch(`${API}/tasks`);
    const tasks = await res.json();
    const tbody = document.querySelector('#tasksTable tbody');
    tbody.innerHTML = '';
    tasks.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${t.id}</td>
      <td>${t.title}</td>
      <td><input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}" class="toggle" /></td>
      <td class="actions">
        <button data-id="${t.id}" class="view">View</button>
        <button data-id="${t.id}" class="edit">Edit</button>
        <button data-id="${t.id}" class="del">Delete</button>
        <button data-id="${t.id}" class="send">Send email</button>
      </td>
    `;
        tbody.appendChild(tr);
    });
}

document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    await fetch(`${API}/tasks`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title, description })
    });
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    fetchTasks();
});

document.addEventListener('click', async (e) => {
    const id = e.target.dataset?.id;
    if (!id) return;
    if (e.target.classList.contains('view')) {
        const res = await fetch(`${API}/tasks/${id}`);
        const task = await res.json();
        document.getElementById('detail').innerText = JSON.stringify(task, null, 2);
    } else if (e.target.classList.contains('del')) {
        await fetch(`${API}/tasks/${id}`, { method:'DELETE' });
        fetchTasks();
    } else if (e.target.classList.contains('edit')) {
        const newTitle = prompt('New title?');
        if (newTitle === null) return;
        await fetch(`${API}/tasks/${id}`, {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ title: newTitle, description: '', completed: false })
        });
        fetchTasks();
    } else if (e.target.classList.contains('send')) {
        const to = prompt('Send to email (example@example.com)');
        if (!to) return alert('No email');
        const resp = await fetch(`${API}/tasks/${id}/send`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to })
        });
        const json = await resp.json();
        alert(JSON.stringify(json));
    }
});

document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('toggle')) {
        const id = e.target.dataset.id;
        const completed = e.target.checked;
        // fetch existing task to get title/desc
        const res = await fetch(`${API}/tasks/${id}`);
        const task = await res.json();
        await fetch(`${API}/tasks/${id}`, {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ title: task.title, description: task.description, completed })
        });
        fetchTasks();
    }
});

fetchTasks();