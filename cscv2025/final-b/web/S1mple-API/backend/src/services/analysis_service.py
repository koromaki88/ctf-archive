from fastapi import HTTPException
from utils import get_user_by
from fastapi import Form, Request
import datetime

async def request_inspect(request: Request):
    return {
        "headers": dict(request.headers),
        "form_parameters": dict(await request.form())
    }

def process_data(username: str = Form(...), script: str = Form(...)):
    user_data = get_user_by("username", username)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    safe_globals = {
        "__builtins__": {
            "len": len,
            "sum": sum,
            "min": min,
            "max": max,
            "sorted": sorted,
            "range": range,
            "map": map,
            "filter": filter,
            # "print": print,
        }
    }
    safe_locals = {"user": user_data}

    try:
        exec(script, safe_globals, safe_locals)
    except Exception:
        return {"executed":1}

    return {"executed":1}
