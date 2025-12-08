const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const BACKEND = { host: 'backend', port: 5555 };

function sendPostRequest(host, port, path, payload, headers = {}) {
    return new Promise((resolve, reject) => {
        const postData = typeof payload === 'object' ? querystring.stringify(payload) : payload;
        
        const options = {
            host,
            port,
            path,
            method: 'POST',
            headers: Object.assign({
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            }, headers)
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
        });
        req.setTimeout(1000, () => {
            req.abort();
            reject(new Error("Request timed out"));
        });
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const response = await sendPostRequest(BACKEND.host, BACKEND.port, '/auth/login', {username, password});
        res.json(response);
    } catch (err) {
        res.status(500).json({ error: 'Login failed', details: err.message });
    }
});

app.post('/request_inspect', async (req, res) => {
    const { data, headers, access_token } = req.body; 
    if (!access_token) {
        return res.status(401).json({ error: 'Missing access_token' });
    }
    try {
        if (headers) {
            try {
                requestHeaders = JSON.parse(headers);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid headers format. Must be a valid JSON string.', details: e.message });
            }
        }
        const finalHeaders = {
            Authorization: `Bearer ${access_token}`,
            ...requestHeaders
        };
        
        const response = await sendPostRequest(BACKEND.host, BACKEND.port, '/analysis/request_inspect', data, finalHeaders);
        res.json(response);
    } catch (err) {
        res.status(500).json({ error: 'Request inspection failed', details: err.message });
    }
});

app.post('/process', async (req, res) => {
    try {
        const { username, script, access_token } = req.body;
        if (!access_token) {
            return res.status(401).json({ error: 'Missing access_token' });
        }
        const response = await sendPostRequest(BACKEND.host, BACKEND.port, '/analysis/process_data', { username, script }, { 'Authorization': `Bearer ${access_token}` });
        res.json(response);
    } catch (err) {
        res.status(200).json({ executed: '1' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Front-end running at http://localhost:${PORT}`));
