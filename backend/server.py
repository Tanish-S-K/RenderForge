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

import json
from datetime import datetime, timezone, timedelta
import httpx

from fastapi import FastAPI, UploadFile, File, Form
import supabase
import redis
import dotenv
import os
from datetime import datetime

dotenv.load_dotenv()

SP_URL = os.getenv("SUPABASE_URL")
SP_KEY = os.getenv("SUPABASE_KEY")
REDIS_ENDPOINT = os.getenv("redis_endpoint")
REDIS_PASSWORD = os.getenv("redis_password")
REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_ENDPOINT}"

app = FastAPI()

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
        response = httpx.post(f"http://localhost:8001/merge/{job_id}",timeout=None)
        output_file = response.json()["output_file"]
        content = open(output_file,"rb").read()

        name = sp.table("job").select("name").eq("job_id",job_id).execute().data[0]["name"]
        user_id = sp.table("job").select("user_id").eq("job_id",job_id).execute().data[0]["user_id"]

        sp.storage.from_("RFV2").upload(f"users/{user_id}/output/{name}.mp4",content)
        sp.table("job").update({"status":"done"}).eq("job_id",job_id).execute()
        return {"message": "Merged successfully"}
    else:
        return {"message": "Invalid request, job not complete yet"}

@app.get("/heartbeat/{machine_id}")
def record_heartbeat(machine_id: str):
    sp.table("device").update({"last_seen": datetime.now(timezone.utc).isoformat(),"status": "free"}).eq("machine_id",machine_id).execute()
    return {"message":"Recorded"}

def check_machine():
    while True:
        time.sleep(17)

        threshold = datetime.now(timezone.utc) - timedelta(seconds=30)

        devices = sp.table("device").select("*").execute().data

        for d in devices:
            last_seen = datetime.fromisoformat(d["last_seen"])

            if last_seen<threshold and d["status"] != "inactive":
                print("HERE")
                machine_id = d["machine_id"]

                sp.table("device").update({
                    "status": "inactive"
                }).eq("machine_id", machine_id).execute()

                subtasks = sp.table("subtask").select("*").eq("machine_id", machine_id).eq("status", "processing").execute().data

                for sub in subtasks:

                    sp.table("subtask").update({
                        "machine_id": None,
                        "status": "pending"
                    }).eq("id", sub["id"]).execute()

                    put_ready_queue(sub["job_id"], sub["subtask_id"])
            

# redis setup: https://share.google/aimode/nszQ2NXoCmcwM5jTk