// backend/src/mail.js
require('dotenv').config();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const POP3Client = require('poplib');

// ─── SMTP ────────────────────────────────────────────────────────────────────
async function sendMail({ to, subject, text, html }) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true', // false = STARTTLS on 587
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
    });

    await transporter.verify(); // проверяем соединение перед отправкой

    const info = await transporter.sendMail({
        from: `"ToDo App" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
    });

    return { messageId: info.messageId, response: info.response };
}

// ─── IMAP ────────────────────────────────────────────────────────────────────
function checkImap({ host, port, tls, user, password, max = 5 }) {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user,
            password,
            host,
            port,
            tls,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000,
        });

        const results = [];

        imap.once('ready', () => {
            imap.openBox('INBOX', true, (err, box) => {
                if (err) { imap.end(); return reject(err); }

                const total = box.messages.total;
                if (total === 0) { imap.end(); return resolve([]); }

                const fetchCount = Math.min(max, total);
                const seqFrom = total - fetchCount + 1;

                const f = imap.seq.fetch(`${seqFrom}:${total}`, {
                    bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                });

                f.on('message', (msg) => {
                    const item = {};
                    msg.on('body', (stream) => {
                        let buf = '';
                        stream.on('data', chunk => buf += chunk.toString('utf8'));
                        stream.once('end', () => {
                            item.header = Imap.parseHeader(buf);
                        });
                    });
                    msg.once('attributes', attrs => { item.uid = attrs.uid; });
                    msg.once('end', () => results.push(item));
                });

                f.once('error', err => { imap.end(); reject(err); });
                f.once('end', () => { imap.end(); resolve(results); });
            });
        });

        imap.once('error', err => reject(err));
        imap.once('end', () => {});
        imap.connect();
    });
}

// ─── POP3 ────────────────────────────────────────────────────────────────────
function checkPop3({ host, port, user, password, tls = false }) {
    return new Promise((resolve, reject) => {
        const client = new POP3Client(port, host, {
            tlserrs: false,
            enabletls: tls,
            ignoretlserrs: true,
            debug: false,
        });

        const timeout = setTimeout(() => {
            reject(new Error('POP3 connection timeout'));
        }, 15000);

        client.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        client.on('connect', () => {
            client.login(user, password);
        });

        client.on('login', (status, data) => {
            if (!status) {
                clearTimeout(timeout);
                client.quit();
                return reject(new Error(`POP3 login failed: ${data}`));
            }
            client.list();
        });

        client.on('list', (status, msgcount, msgnumber, data) => {
            clearTimeout(timeout);
            if (!status) {
                client.quit();
                return reject(new Error('POP3 LIST failed'));
            }
            resolve({ messageCount: msgcount });
            client.quit();
        });

        client.on('quit', () => {});
    });
}

module.exports = { sendMail, checkImap, checkPop3 };