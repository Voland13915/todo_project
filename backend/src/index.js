// backend/src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const { sendMail, checkImap, checkPop3 } = require('./mail');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

/* CRUD for tasks */

// Get all tasks
app.get('/tasks', async (req, res) => {
    const result = await db.query('SELECT * FROM tasks ORDER BY id');
    res.json(result.rows);
});

// Get by id
app.get('/tasks/:id', async (req, res) => {
    const id = Number(req.params.id);
    const result = await db.query('SELECT * FROM tasks WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
});

// Create
app.post('/tasks', async (req, res) => {
    const { title, description } = req.body;
    const result = await db.query(
        'INSERT INTO tasks(title, description) VALUES($1,$2) RETURNING *',
        [title, description]
    );
    res.status(201).json(result.rows[0]);
});

// Update
app.put('/tasks/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { title, description, completed } = req.body;
    const result = await db.query(
        'UPDATE tasks SET title=$1, description=$2, completed=$3 WHERE id=$4 RETURNING *',
        [title, description, completed, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
});

// Delete
app.delete('/tasks/:id', async (req, res) => {
    const id = Number(req.params.id);
    const result = await db.query('DELETE FROM tasks WHERE id=$1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
});

/* Email: send task by email */
app.post('/tasks/:id/send', async (req, res) => {
    const id = Number(req.params.id);
    const { to } = req.body;
    const taskRes = await db.query('SELECT * FROM tasks WHERE id=$1', [id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: 'task not found' });
    const task = taskRes.rows[0];
    try {
        const info = await sendMail({
            to,
            subject: `Task ${task.id}: ${task.title}`,
            text: `Task: ${task.title}\n\n${task.description || ''}\n\nCompleted: ${task.completed}`,
            html: `<h3>${task.title}</h3><p>${task.description || ''}</p><p>Completed: ${task.completed}</p>`
        });
        res.json({ success: true, info });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/* Minimal endpoints to check IMAP/POP3 */
app.get('/email/imap', async (req, res) => {
    try {
        const data = await checkImap({
            host: process.env.IMAP_HOST,
            port: Number(process.env.IMAP_PORT || 993),
            tls: (process.env.IMAP_TLS === 'true'),
            user: process.env.IMAP_USER,
            password: process.env.IMAP_PASS,
            max: 5
        });
        res.json({ success: true, messages: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/email/pop3', async (req, res) => {
    try {
        const data = await checkPop3({
            host: process.env.POP3_HOST,
            port: Number(process.env.POP3_PORT || 110),
            user: process.env.POP3_USER,
            password: process.env.POP3_PASS
        });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
});