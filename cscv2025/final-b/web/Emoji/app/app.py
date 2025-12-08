import duckdb
from flask import Flask, render_template, request, redirect, session
import ftfy
import os
import threading
import time
from llama_cpp import Llama
import uuid
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(64)

DB_FILE = "db/emojis.duckdb"

def init_db():
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
    con = duckdb.connect(DB_FILE)
    con.execute("CREATE TABLE IF NOT EXISTS emojis (session_id TEXT, combo TEXT UNIQUE, result TEXT)")
    con.close()

def clean_db_periodically():
    while True:
        try:
            print("Cleaning DB...")
            con = duckdb.connect(DB_FILE)
            con.execute("DELETE FROM emojis")
            con.close()
        except Exception as e:
            print("DB cleanup failed:", e)
        time.sleep(60)

init_db()
threading.Thread(target=clean_db_periodically, daemon=True).start()

llm = Llama(model_path="./models/qwen1_5-0_5b-chat-q4_0.gguf", n_ctx=2048, embedding=False, logits_all=False, vocab_only=False, use_mmap=True)

def combine(combo):
    prompt = f"Respond with just the emoji. Combine these two emojis {combo} into a single new emoji idea."
    output = llm.create_chat_completion(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an assistant.\n"
                    "If asked for anything unrelated politely refuse."
                )
            },
            {"role": "user", "content": prompt}
        ],
        max_tokens=200,
        temperature=0.7,
    )
    return output["choices"][0]["message"]["content"].strip()

SESSION_TIMEOUTS = {}

@app.before_request
def ensure_session():
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())

@app.before_request
def rate_limit():
    if request.endpoint == "index" and request.method == "POST":
        sid = session.get("sid")
        now = time.time()
        last = SESSION_TIMEOUTS.get(sid, 0)
        if now - last < 5:
            return "<h1>Rate limit: Only one question per 5 seconds.</h1>", 429
        SESSION_TIMEOUTS[sid] = now

@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    if request.method == "POST":
        emoji1 = request.form.get("emoji1", "")
        emoji2 = request.form.get("emoji2", "")
        combo = f"{emoji1} and {emoji2}"
        blacklist = ["'", "\"", ";", "`", "/", "\\", "%", "#", "--"]
        lowered_type = combo.lower()
        if any(bad in lowered_type for bad in blacklist):
            return "<h1> Invalid! </h1>", 400
        
        result = combine(combo)

        con = duckdb.connect(DB_FILE)
        try:
            con.execute(
                "INSERT INTO emojis (session_id, combo, result) VALUES (?, ?, ?)",
                [session["sid"], combo, result]
            )
        except Exception:
            pass
        con.close()
        return render_template("index.html", result=result)

    return render_template("index.html", result=result)

@app.route("/search", methods=["GET", "POST"])
def search():
    results = []
    if request.method == "POST":
        query = request.form.get("query", "")
        con = duckdb.connect(DB_FILE)
        emoji = con.execute(
            "SELECT result FROM emojis WHERE session_id = ? AND (combo LIKE ? OR result LIKE ?)", [session["sid"], f"%{query}%", f"%{query}%"]
        ).fetchall()
        if emoji:
            query_str = f"SELECT combo, result FROM emojis WHERE result = '{ftfy.fix_text(emoji[0][0])}'"
            results = con.execute(query_str).fetchall()
        con.close()
    return render_template("search.html", results=results, fix_text=ftfy.fix_text)

if __name__ == "__main__":
    app.run(debug=True)
