from flask import Flask, request, send_file
import http.client, json, os
app = Flask(__name__)

API_HOST = "127.0.0.1"
MAX_NOTE = 10
TOKEN = None
def get_note(id):
    global TOKEN
    if not TOKEN:
        print("No token found!")
        return None
    else:
        try:
            id = int(id)
            conn = http.client.HTTPConnection(API_HOST, 80)
            conn.request("GET", f"/api/note/{id}", headers={
                "X-Token": TOKEN
            })
            r = conn.getresponse().read().decode()
            r = json.loads(r)
            conn.close()
            return r
        except Exception:
            return None

def add_note(name, content):
    global TOKEN
    if not TOKEN:
        print("No token found!")
        return None
    else:
        try:
            conn = http.client.HTTPConnection(API_HOST, 80)
            conn.request("POST", "/api/note", body=json.dumps({
                "token": TOKEN,
                "name": name.capitalize(),
                "content": content
            }), headers={
                "Content-Type": "application/json",
                "Content-Length": len(json.dumps({"token": TOKEN,"name": name,"content": content}))
            })
            r = conn.getresponse().read().decode()
            print(r, flush=True)
            r = json.loads(r)
            conn.close()
            return r
        except Exception:
            return None

@app.route('/')
def home():
    resp = "<div>"
    for i in range(1, MAX_NOTE):
        note = get_note(i)
        if note:
            resp += f"<p>title: {note['name']}</p>"
            resp += f"<p>content: {note['content']}</p>"
    resp += "</div>"
    return resp

@app.route('/add_note', methods=["POST"])
def do_add_note():
    name = request.form["name"]
    content = request.form["content"]
    resp = add_note(name, content)
    if resp != None and resp["error"] == 0:
        return "OK"
    else:
        return "Error"
    
@app.route('/draft')
def do_read_draft():
    try:
        f_name = request.args.get("draft")
        # no pipe
        if ((os.stat(f_name).st_mode >> 12) & 1) == 1:
            return "Error"
        return send_file(request.args.get("draft"))
    except:
        return "Error"

@app.route('/token', methods=["POST"])
def do_token():
    global TOKEN
    if not TOKEN:
        if request.form["token"].isalnum():
            TOKEN = request.form["token"]
            return "token received!"
        else:
            return "invalid token!"
    return "token already exists!"

if __name__ == '__main__':
    app.run("0.0.0.0", 5000)
