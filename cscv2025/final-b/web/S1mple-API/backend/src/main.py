from fastapi import FastAPI, Request, Depends, Form
from db import init_db
from services.auth_service import login, update_password, forgot_password
from services.analysis_service import process_data, request_inspect
from utils import verify_token

app = FastAPI()

@app.on_event("startup")
def startup():
    init_db()

@app.post("/auth/login")
def auth_login(username: str = Form(...), password: str = Form(...)):
    return login(username, password)

# Internal Only
@app.post("/auth/update_password")
def auth_update_password(username: str = Form(...), token: str = Form(...), new_password: str = Form(...)):
    return update_password(username, token, new_password)

# Internal Only
@app.post("/auth/forgot_password")
def auth_forgot_password(email: str = Form(...)):
    return forgot_password(email)

# Admin Only
@app.post("/analysis/process_data")
def analysis_process_data(username: str = Form(...), script: str = Form(...), auth=Depends(verify_token)):
    return process_data(username, script)

# Admin Only
@app.post("/analysis/request_inspect")
async def inspect_request(request: Request, auth=Depends(verify_token)):
    return await request_inspect(request)
