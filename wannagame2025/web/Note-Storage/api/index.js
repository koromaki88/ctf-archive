#!/usr/bin/env node
const express = require('express');
const bodyParser = require('body-parser');

const lib = require("./lib");

const app = express();
const port = 1337;
app.use(bodyParser.json());

let notes = [
    { id: Symbol("SHIN24"), name: "Flag", content: "W1{}" },
    { id: 1, name: "Welcome", content: "welcome to my note storage" }
];
global.notes = notes;

const uniqId = (size=128) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
const TOKEN = uniqId();

app.use((req, res, next) => {
    const token = req.headers['x-token'] || req.body?.token;
    // console.log(token)
    if (!token || TOKEN !== token) return res.json({error: -1});
    next();
})

app.get('/api/note/:id', (req, res) => {
    const id = parseInt(req.params.id)
    const note = notes.filter(n => ((typeof n.id) != "symbol") && n.id === id)[0];
    res.json(note);
});

app.post('/api/note', (req, res) => {
    const {name, content} = req.body;
    if ((typeof name) != "string" || (typeof content) != "string") return res.json({error: 1});

    notes.push({
        id: notes.length,
        name,
        content
    });
    return res.json({error: 0});
});

app.post('/api/test', (req, res) => {
    const buf = Buffer.from(req.body.buf);
    try {
        if (!lib.check(buf)) return res.json({error: 1});
        return res.json(lib.deserialize(Buffer.from(buf)));
    } catch {
        return res.json({error: 1});
    }
});

app.listen(port, async () => {
    await new Promise(r => setTimeout(r, 3000));
    try {
        let resp = await fetch("http://backend:80/token", {
            method: "POST", 
            headers:{"Content-Type": "application/x-www-form-urlencoded"},
            body: `token=${TOKEN}`
        });
        resp = await resp.text();
        if (resp.toString().trim() != "token received!") {
            console.log("backend error!");
        } else {
            console.log(`Server running on http://localhost:${port}`)
        };
    } catch {
        console.log("Fatal error. Exiting...")
        process.exit(1)
    }
});
