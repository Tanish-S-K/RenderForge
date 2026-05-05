"""
    core logic : gets job from queue, renders it, and sends it to storage
    other stuff : sends a heartbeat to the server every 10 seconds to let it know it's alive,
                  gives the server a unique fingerprint of the device

"""

import redis,supabase,subprocess
import os,time,json,dotenv,httpx
import platform,uuid,hashlib,threading

dotenv.load_dotenv()

SP_URL = os.getenv("SUPABASE_URL")
SP_KEY = os.getenv("SUPABASE_KEY")
REDIS_ENDPOINT = os.getenv("redis_endpoint")
REDIS_PASSWORD = os.getenv("redis_password")
BLENDER_PATH = os.getenv("BLENDER_PATH")

mid = None

REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_ENDPOINT}"


red = redis.from_url(REDIS_URL, decode_responses=True)
sp = supabase.create_client(SP_URL,SP_KEY)

# subjob structure:    id, subtask_id, start_frame, lenght, format, status, timestamp, machine_id.

class subjob:
    def __init__(self, job_id, subtask_id, start_frame, length, format):
        self.job_id = job_id
        self.subtask_id = subtask_id
        self.start_frame = start_frame
        self.length = length
        self.format = format
        self.status = "ready"
        self.timestamp = time.time()
        self.machine_id = mid

def get_job():
    # if queue not empty:
        # get as subjob object remove fromt the queue
        # update status in table to "processing"
        # download the file from storage 
        # return file path,subjob object
    # return None

    if red.zcard("ready_queue") >0:
        data = json.loads(red.zpopmin("ready_queue")[0][0])
        sp.table("subtask").update({"status": "processing", "machine_id": mid}).eq("job_id", data["job_id"]).eq("subtask_id", data["subtask_id"]).execute()
        data = sp.table("subtask").select("*").eq("job_id", data["job_id"]).eq("subtask_id", data["subtask_id"]).execute().data[0]

        job = subjob(
            job_id=data["job_id"],
            subtask_id=data["subtask_id"],
            start_frame=data["start_frame"],
            length=data["length"],
            format=data["format"]
        )
        
        user_id = sp.table("job").select("user_id").eq("job_id", data["job_id"]).execute().data[0]["user_id"]
        filename = sp.table("job").select("name").eq("job_id", data["job_id"]).execute().data[0]["name"]
        content = sp.storage.from_("RFV2").download(f"users/{user_id}/input/{filename}.blend")
        
        with open("./workplace/work.blend", "wb") as f:
            f.write(content)

        return ("./workplace/work.blend", job)
    print("no job in queue")
    return None

def send_heartbeat():

    # api route: /heartbeat/{machine_id}
    # post request to api route every 15 sec;

    while True:
        try:
            httpx.get(f"http://localhost:8000/heartbeat/{mid}")
        except:
            print("device failed restarting")
        time.sleep(15)
    

def render_job(loc, start_frame, length, subtask_id):
    end_frame = start_frame + length - 1

    output_dir = "./rendered/"
    os.makedirs(output_dir, exist_ok=True)
    
    output_dir_abs = os.path.abspath(output_dir)
    output_path = os.path.join(output_dir_abs, f"{subtask_id}")

    script = (
        "import bpy;"
        "prefs = bpy.context.preferences.addons['cycles'].preferences;"
        "prefs.compute_device_type = 'CUDA';"
        "prefs.get_devices();"
        "[setattr(d, 'use', True) for d in prefs.devices];"
        "bpy.context.scene.cycles.device = 'GPU';"
        "bpy.context.scene.render.use_persistent_data = True;"
        "bpy.context.scene.render.image_settings.file_format = 'FFMPEG';"
        "bpy.context.scene.render.ffmpeg.format = 'MPEG4';"
        "bpy.context.scene.render.ffmpeg.codec = 'H264';"
        f"bpy.context.scene.frame_start = {start_frame};"
        f"bpy.context.scene.frame_end = {end_frame};"
    )

    subprocess.run([
        BLENDER_PATH,
        "--background", loc,
        "--python-expr", script,
        "--render-output", output_path,
        "-x", "1",
        "--render-anim",
        "-s", str(start_frame),
        "-e", str(end_frame),
    ], check=True)

    actual_output = f"{output_path}{start_frame:04d}-{end_frame:04d}.mp4"
    os.rename(actual_output, f"{output_path}.mp4")
    return f"{output_path}.mp4"

def send_to_storage(job, user_id):
    
    # get storge url using the object_id;
    # upload the file with name id+subtask_id to the storage;

    sp.storage.from_("RFV2").upload(f"users/{user_id}/subtasks/{os.path.basename(job)}", open(job, "rb").read())
    os.remove(job)
    sp.table("device").update({"status":"free"}).eq("machine_id",mid).execute()
    return {"message": "File uploaded successfully"}

def send_machine_failed(job):

    # api route: /machine_failed/{job_id}
    # post request to api route;
    pass

def report_job_done(job):
    # in the job table update alive -= 1 @job_id
    # if alive == 0 then report to api route /job_complete/{job_id}

    sp.table("subtask").update({"status": "done"}).eq("job_id", job.job_id).eq("subtask_id", job.subtask_id).execute()
    sp.rpc("decrement_alive_cnt", {"jid": job.job_id}).execute()

    if (sp.table("job").select("alive_cnt").eq("job_id", job.job_id).execute().data[0]["alive_cnt"] == 0):
        return httpx.post(f"http://localhost:8000/job_complete/{job.job_id}",timeout=None)
    return {"message": "Job reported as done"}



def get_device_fingerprint():
    try:
        mac = uuid.getnode()
    except:
        mac = "unknown"

    data = [
        platform.system(),
        platform.node(),
        platform.machine(),
        str(mac)
    ]

    raw = "|".join(data)
    fingerprint = hashlib.sha256(raw.encode()).hexdigest()

    return str(fingerprint)

def main():
    global mid
    mid = httpx.post(f"http://localhost:8002/register/machine/",json={"finger_print":get_device_fingerprint(),"user_id":"b83ad1b7-72b1-4baa-9dfb-a84d1b876c19"}).json()
    print(mid)
    mid = mid["machine_id"]
    threading.Thread(target=send_heartbeat, daemon=True).start()

    while True:
        # check for the job
        # available
            # do it return it;
            # any error inform server
        # wait 5 seconds
        # send heartbeat to server

        job = get_job()

        if not job:
            time.sleep(5)
            continue
        url,job = job

        rendered_job = render_job(url, job.start_frame, job.length, job.subtask_id)
        
        if not rendered_job:
            send_machine_failed(job)
            continue
        user_id = sp.table("job").select("user_id").eq("job_id", job.job_id).execute().data[0]["user_id"]
        
        send_to_storage(rendered_job, user_id)
        report_job_done(job)
        

if __name__ == "__main__":
    main()