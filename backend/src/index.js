// backend/src/index.js
require('dotenv').config();
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const db = require('./db');
const { sendMail, checkImap, checkPop3 } = require('./mail');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

// ─── HTTP SERVER (нужен для совместного использования с WS) ──────────────────
const server = http.createServer(app);

// ─── WEBSOCKET SERVER ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Рассылка события всем подключённым клиентам
function broadcast(event) {
    const payload = JSON.stringify(event);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(payload);
        }
    });
}

wss.on('connection', (ws, req) => {
    console.log(`[WS] Client connected. Total: ${wss.clients.size}`);

    // Пинг каждые 30 сек, чтобы не закрывалось соединение
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => {
        console.log(`[WS] Client disconnected. Total: ${wss.clients.size}`);
    });

    ws.on('error', err => {
        console.error('[WS] Client error:', err.message);
    });

    // Отправляем приветственное сообщение с текущим количеством клиентов
    ws.send(JSON.stringify({ type: 'connected', clientCount: wss.clients.size }));
});

// Пинг-понг для обнаружения мёртвых соединений
const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => clearInterval(pingInterval));

// ─── TASKS CRUD ───────────────────────────────────────────────────────────────

app.get('/tasks', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM tasks ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/tasks/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM tasks WHERE id=$1', [Number(req.params.id)]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tasks', async (req, res) => {
    try {
        const { title, description } = req.body;
        const result = await db.query(
            'INSERT INTO tasks(title, description) VALUES($1,$2) RETURNING *',
            [title, description]
        );
        const task = result.rows[0];
        broadcast({ type: 'task_created', payload: task });
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/tasks/:id', async (req, res) => {
    try {
        const { title, description, completed } = req.body;
        const result = await db.query(
            'UPDATE tasks SET title=$1, description=$2, completed=$3 WHERE id=$4 RETURNING *',
            [title, description, completed, Number(req.params.id)]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        const task = result.rows[0];
        broadcast({ type: 'task_updated', payload: task });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/tasks/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM tasks WHERE id=$1 RETURNING *', [Number(req.params.id)]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        const task = result.rows[0];
        broadcast({ type: 'task_deleted', payload: { id: task.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── EMAIL: SEND TASK ─────────────────────────────────────────────────────────

app.post('/tasks/:id/send', async (req, res) => {
    try {
        const taskRes = await db.query('SELECT * FROM tasks WHERE id=$1', [Number(req.params.id)]);
        if (taskRes.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

        const task = taskRes.rows[0];
        const { to } = req.body;
        if (!to) return res.status(400).json({ error: 'Email address (to) is required' });

        const info = await sendMail({
            to,
            subject: `Task #${task.id}: ${task.title}`,
            text: `Task: ${task.title}\n\n${task.description || '—'}\n\nCompleted: ${task.completed ? 'Yes' : 'No'}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px">
                    <h2 style="color:#4f46e5">Task #${task.id}: ${task.title}</h2>
                    <p>${task.description || '<em>No description</em>'}</p>
                    <p>Status: <strong>${task.completed ? '✅ Completed' : '⏳ In progress'}</strong></p>
                    <hr/>
                    <small style="color:#888">Sent from ToDo App</small>
                </div>
            `,
        });

        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('SMTP error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── EMAIL: IMAP ──────────────────────────────────────────────────────────────

app.get('/email/imap', async (req, res) => {
    try {
        const messages = await checkImap({
            host: process.env.IMAP_HOST || 'imap.gmail.com',
            port: Number(process.env.IMAP_PORT || 993),
            tls: process.env.IMAP_TLS !== 'false',
            user: process.env.IMAP_USER,
            password: process.env.IMAP_PASS,
            max: 5,
        });
        res.json({ success: true, protocol: 'IMAP', count: messages.length, messages });
    } catch (err) {
        console.error('IMAP error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── EMAIL: POP3 ──────────────────────────────────────────────────────────────

app.get('/email/pop3', async (req, res) => {
    try {
        const data = await checkPop3({
            host: process.env.POP3_HOST || 'pop.gmail.com',
            port: Number(process.env.POP3_PORT || 995),
            tls: process.env.POP3_TLS !== 'false',
            user: process.env.POP3_USER,
            password: process.env.POP3_PASS,
        });
        res.json({ success: true, protocol: 'POP3', ...data });
    } catch (err) {
        console.error('POP3 error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── HEALTH CHECK (для CI/CD) ─────────────────────────────────────────────────

app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', ws_clients: wss.clients.size });
    } catch (err) {
        res.status(503).json({ status: 'error', error: err.message });
    }
});

// ─── START ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
    console.log(`Backend + WebSocket listening on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});