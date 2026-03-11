// backend/src/mail.js
const nodemailer = require('nodemailer');
require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser'); // mailparser optional (not in package.json by default)
const POP3Client = require('poplib');

async function sendMail({ to, subject, text, html }) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: Number(process.env.SMTP_PORT || 1025),
        secure: (process.env.SMTP_SECURE === 'true'),
        auth: (process.env.SMTP_USER)
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        tls: { rejectUnauthorized: false }
    });

    const info = await transporter.sendMail({
        from: process.env.SMTP_USER || 'todo@example.test',
        to, subject, text, html
    });
    return info;
}

/*
 Minimal IMAP check: fetch newest N headers.
 Note: uses 'imap' package. For production prefer higher-level libraries.
*/
function checkImap({ host, port, tls, user, password, max = 5 }) {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user,
            password,
            host,
            port,
            tls
        });
        const results = [];
        imap.once('ready', function() {
            imap.openBox('INBOX', true, function(err, box) {
                if (err) { imap.end(); return reject(err); }
                const fetchCount = Math.min(max, box.messages.total);
                if (fetchCount === 0) { imap.end(); return resolve([]); }

                const seqFrom = box.messages.total - fetchCount + 1;
                const f = imap.seq.fetch(`${seqFrom}:${box.messages.total}`, { bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)' });
                f.on('message', function(msg, seqno) {
                    const item = {};
                    msg.on('body', function(stream) {
                        let buffer = '';
                        stream.on('data', chunk => buffer += chunk.toString('utf8'));
                        stream.once('end', () => { item.header = Imap.parseHeader(buffer); });
                    });
                    msg.once('attributes', attrs => item.attrs = attrs);
                    msg.once('end', () => results.push(item));
                });
                f.once('error', function(err) { imap.end(); reject(err); });
                f.once('end', function() { imap.end(); resolve(results); });
            });
        });
        imap.once('error', err => reject(err));
        imap.connect();
    });
}

/*
 Minimal POP3 check: return TOP lines or list.
 Uses poplib (blocking-like interface)
*/
function checkPop3({ host, port, user, password }) {
    return new Promise((resolve, reject) => {
        const client = new POP3Client(port, host, {
            tlserrs: false,
            enabletls: false,
            debug: false
        });

        client.on('error', function(err) {
            reject(err);
        });
        client.on('connect', function() {
            client.login(user, password);
        });
        client.on('login', function(status) {
            if (!status) { client.quit(); return reject(new Error('POP3 login failed')); }
            client.list();
        });
        client.on('list', function(status, msgcount) {
            if (!status) { client.quit(); return reject(new Error('POP3 LIST failed')); }
            resolve({ messageCount: msgcount });
            client.quit();
        });
    });
}

module.exports = { sendMail, checkImap, checkPop3 };