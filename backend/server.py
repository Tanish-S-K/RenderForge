"""
    core function: 
        - gets the job,users,machines from user put in table/storage
        - splits the job into subtask and put in queue
        - if job done message received then send to merge
        - after merge return to storage then to user
    other functions:
        - if any node dies then reupload its latest subtask to queue if not done
        - remove all temporary file/folders in the process
"""
"""
    api routes:
        - POST: /heartbeat/{machine_id}
        - GET: /storage_url/{machine_id} , body: job_id
        - POST: /machine_failed/{job_id} , body: machine_id
        - POST: /register/user/
        - POST: /register/machine/
        - POST: /register/job/
        - POST: /login/user/
"""

from datetime import datetime, timezone, timedelta
import httpx
from fastapi import Depends, Header
import shutil,zipfile,uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi import BackgroundTasks
import supabase
import redis
import dotenv
import os,time,json
from datetime import datetime
import threading
import subprocess
from fastapi.responses import FileResponse
import json, os, uuid

dotenv.load_dotenv()

SP_URL = os.getenv("SUPABASE_URL")
SP_KEY = os.getenv("SUPABASE_KEY")
REDIS_ENDPOINT = os.getenv("redis_endpoint")
REDIS_PASSWORD = os.getenv("redis_password")
REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_ENDPOINT}"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sp = supabase.create_client(SP_URL,SP_KEY)
red = redis.from_url(REDIS_URL, decode_responses=True)

#  ----- functions -----

def alive_nodes_cnt():
    threshold = datetime.now(timezone.utc).timestamp()-30
    devices = sp.table("device").select("*").execute().data
    
    cnt = 0
    for d in devices:
        last_seen = datetime.fromisoformat(d["last_seen"]).timestamp()
        if last_seen > threshold and d["status"] == "free":
            cnt += 1
    
    return max(cnt, 1)

def put_ready_queue(job_id,subtask_id):
    curtask = {
        "job_id": job_id,
        "subtask_id": subtask_id,
    }
    create_time = sp.table("job").select("created_at").eq("job_id", job_id).execute().data[0]["created_at"]
    dt = datetime.fromisoformat(create_time.replace("Z", "+00:00"))
    score = dt.timestamp()
    red.zadd("ready_queue", {json.dumps(curtask): float(score)})

def split_job(job_id, start_frame, end_frame, format):
    # split the given job into n subtasks
    # put all the n subtasks in job table @job_id
    # set alive of job to n
    # return [subtask_id]

    l = start_frame
    r = end_frame
    length = r-l+1
    size = length//alive_nodes_cnt()

    for i in range(l, r+1, size):
        subtask = {
            "job_id": job_id,
            "subtask_id": (i-l)//size+1,
            "start_frame": i,
            "length": min(size, r-i+1),
            "format": format,
        }
        put_ready_queue(job_id, subtask["subtask_id"])
        sp.rpc("increment_job_counts", {"jid": job_id}).execute()
        sp.table("subtask").insert(subtask).execute()
    sp.table("job").update({"status":"processing"}).eq("job_id",job_id).execute()
    return {"message": "Job split successfully"}

@app.post("/register/job/")
async def register_job(
    user_id: str = Form(...),
    name: str = Form(...),
    start_frame: int = Form(...),
    end_frame: int = Form(...),
    format: str = Form(...),
    file: UploadFile = File(...)
    ):
    length = end_frame - start_frame + 1
    content = await file.read()

    response = sp.table("job").insert({
        "start_frame": start_frame,
        "length": length,
        "name": name,
        "user_id": user_id,
        "format": format
    }).execute()
    
    sp.storage.from_(f"RFV2/users/{user_id}/input").upload(name+".blend", content)
    job_id = response.data[0]["job_id"]
    split_job(job_id, start_frame, end_frame, format)

    return {"message": "Job registered successfully", "job_id": job_id}


@app.post("/job_complete/{job_id}")
def job_complete(job_id):
    cnt = sp.table("job").select("alive_cnt").eq("job_id", job_id).execute().data[0]["alive_cnt"]

    if (cnt == 0):
        response = httpx.post(f"http://localhost:8000/merge/{job_id}",timeout=None)
        output_file = response.json()["output_file"]
        content = open(output_file,"rb").read()

        name = sp.table("job").select("name").eq("job_id",job_id).execute().data[0]["name"]
        user_id = sp.table("job").select("user_id").eq("job_id",job_id).execute().data[0]["user_id"]

        sp.storage.from_("RFV2").upload(f"users/{user_id}/output/{name}.mp4",content)
        sp.table("job").update({"status":"done"}).eq("job_id",job_id).execute()
        os.remove("./mergespace/list.txt")
        os.remove(f"./mergespace/{name}.mp4")
        return {"message": "Merged successfully"}
    else:
        return {"message": "Invalid request, job not complete yet"}

@app.get("/heartbeat/{machine_id}")
def record_heartbeat(machine_id: str):
    status = sp.table("device").select("status").eq("machine_id",machine_id).execute().data[0]["status"]
    if (status == "inactive"):
        sp.table("device").update({"last_seen": datetime.now(timezone.utc).isoformat(),"status": "free"}).eq("machine_id",machine_id).execute()
    else:
        sp.table("device").update({"last_seen": datetime.now(timezone.utc).isoformat()}).eq("machine_id",machine_id).execute()
    return {"message":"Recorded"}

def check_machine():
    while True:
        try:
            time.sleep(17)

            threshold = datetime.now(timezone.utc) - timedelta(seconds=30)

            devices = sp.table("device").select("*").execute().data

            for d in devices:

                if not d["last_seen"]:
                    continue

                last_seen = datetime.fromisoformat(
                    d["last_seen"].replace("Z", "+00:00")
                )

                if (
                    last_seen < threshold and
                    d["status"] != "inactive"
                ):

                    machine_id = d["machine_id"]

                    print(f"[DEAD NODE] {machine_id}")

                    sp.table("device").update({
                        "status": "inactive"
                    }).eq("machine_id", machine_id).execute()

                    subtasks = (
                        sp.table("subtask")
                        .select("*")
                        .eq("machine_id", machine_id)
                        .eq("status", "processing")
                        .execute()
                        .data
                    )

                    for sub in subtasks:

                        sp.table("subtask").update({
                            "machine_id": None,
                            "status": "pending"
                        }).eq("subtask_id", sub["subtask_id"]).execute()

                        put_ready_queue(
                            sub["job_id"],
                            sub["subtask_id"]
                        )

                        print(
                            f"Requeued subtask "
                            f"{sub['subtask_id']} "
                            f"for job {sub['job_id']}"
                        )

        except Exception as e:
            print("check_machine error:", e)

# --- authentication ---

"""
    core function: login & registeration for machine and user
    other functions: ---
"""

from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from jose import jwt, JWTError

SECRET_KEY = "YouDontKnowTheKey"
ALGORITHM = "HS256"

class LoginRequest(BaseModel):
    email : str
    password : str

class Machine_Request(BaseModel):
    finger_print: str
    user_id: str

def create_session(user_id: str):

    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token

def verify_session(token: str):

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload["user_id"]

    except JWTError:
        return None

@app.post("/login")
async def loginuser(data: LoginRequest):

    row = sp.table("user").select("*").eq("email",data.email).execute().data

    if not row:
        return {"message":"Invalid credentials"}
    password = row[0]["password"]
    user_id = row[0]["user_id"]

    if (password == data.password):
        session_token = create_session(user_id)

        return {
            "message": "Login successful",
            "session": session_token,
            "user_id": user_id
        }
    else:
        return {"message":"Invalid credentials"}

@app.post("/signup")
async def register_user(data: LoginRequest):
    
    # signup with supabase
    # register in the database
    # create session and return
    
    row = sp.table("user").select("*").eq("email",data.email).execute().data

    if row:
        return {"message":"Email already exists"}
    row = sp.table("user").insert({"email":data.email, "password":data.password}).execute()
    user_id = row.data[0]["user_id"]
    session_token = create_session(user_id)

    return {
        "message": "Registered successfully",
        "session": session_token,
        "user_id": user_id
    }

@app.post("/register/machine/")
async def machine_register(data: Machine_Request):
    # receive fingerprint and register

    try:
        res = sp.rpc("get_or_create_machine_id",
            {
                "p_fingerprint": data.finger_print,
                "p_user_id": data.user_id
            }
        ).execute()

        machine_id = res.data
        sp.table("device").update({"status":"free"}).eq("machine_id",machine_id).execute()
        return {"machine_id": machine_id}
    except Exception as e:
        print(e)
        return {"message": e}
    
@app.post("/merge/{job_id}")
def merge_job(job_id):

    output_path = "./mergespace/"

    result = sp.table("job").select("user_id, name").eq("job_id", job_id).execute()
    if not result.data:
        return {"error": f"No job found for job_id={job_id}"}

    user_id = result.data[0]["user_id"]
    name = result.data[0]["name"]

    files = sp.storage.from_("RFV2").list(f"users/{user_id}/subtasks/")
    files.sort(key=lambda x: x['name'])

    file_paths = []

    with open(output_path + "list.txt", "wb") as f:
        for file in files:

            path = f"users/{user_id}/subtasks/{file['name']}"
            file_paths.append(path)

            signed = sp.storage.from_("RFV2").create_signed_url(
                path,
                3600
            )

            url = signed["signedURL"]
            f.write(f"file '{url}'\n".encode("utf-8"))

    subprocess.run([
        "./dependencies/ffmpeg.exe",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
        "-f", "concat",
        "-safe", "0",
        "-i", output_path + "list.txt",
        "-c", "copy",
        output_path + name + ".mp4"
    ])
    try:
        sp.storage.from_("RFV2").remove(file_paths)
    except Exception as e:
        print("Cleanup failed:", e)

    return {
        "message": "Merge complete",
        "output_file": f"{output_path}{name}.mp4"
    }

@app.on_event("startup")
def main():
    threading.Thread(target=check_machine, daemon=True).start()



# --- frontend ---

@app.get("/jobs")
def user_jobs(auth: str=Header(None)):
    token = auth.split(" ")[1]
    user_id = verify_session(token)
    
    if not user_id:
        
        return [{"message":"Login for details"}]
    
    res = sp.table("job").select("*").eq("user_id",user_id).execute().data
    required = [
                {"id":job["job_id"],"job_name":job["name"],"date_posted":job["created_at"],"download_link":"Not Yet","status": job["status"]}
                for job in res
                ]
    
    return required


@app.get("/machines")
def user_machines(auth: str=Header(None)):
    token = auth.split(" ")[1]
    user_id = verify_session(token)
    
    if not user_id:
        
        return [{"message":"Login for details"}]
    
    res = sp.table("device").select("*").eq("user_id",user_id).execute().data
    required = [
                {"id":device["machine_id"],"machine_name":device["status"],"date_opened":device["created_at"],"no_of_jobs":device["last_job_id"]}
                for device in res
                ]
    
    return required

@app.get("/download/agent")
async def download_agent(auth: str = Header(None)):

    if not auth:
        return {"message": "No session"}

    token = auth.split(" ")[1]
    user_id = verify_session(token)

    if not user_id:
        return {"message": "Invalid session"}

    source_folder = "agent"

    config = {
        "user_id": user_id,
        "server": "https://localhost:8000/"
    }

    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zipf:

        for root, _, files in os.walk(source_folder):
            for file in files:

                file_path = os.path.join(root, file)

                arcname = os.path.relpath(file_path, source_folder)

                if file == "config.json":
                    zipf.writestr("config.json", json.dumps(config, indent=4))
                else:
                    zipf.write(file_path, arcname)

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=RF-Agent.zip"
        }
    )

@app.get("/download/config")
async def download_config(auth: str = Header(None)):

    if not auth:
        return {"message": "No session"}

    token = auth.split(" ")[1]
    user_id = verify_session(token)

    if not user_id:
        return {"message": "Invalid session"}

    config = {
        "user_id": user_id,
        "server": "x",
    
        "SUPABASE_URL":"X",
        "SUPABASE_KEY":"x",
        "BLENDER_PATH" : "./blender/blender.exe",

        "redis_endpoint":"x",
        "redis_password":"x",

    }

    path = f"temp/config_{uuid.uuid4()}.json"

    os.makedirs("temp", exist_ok=True)

    with open(path, "w") as f:
        json.dump(config, f, indent=4)

    return FileResponse(
        path,
        filename="config.json",
        media_type="application/json"
    )

@app.get("/public_link")
def get_public_link(job_id: str, auth: str = Header(None)):

    token = auth.split(" ")[1]
    user_id = verify_session(token)

    name = sp.table("job").select("name").eq("job_id", job_id).single().execute().data["name"]


    path = f"users/{user_id}/output/{name}.mp4"

    signed = sp.storage.from_("RFV2").create_signed_url(path, 3600)

    return {"url": signed["signedURL"]}