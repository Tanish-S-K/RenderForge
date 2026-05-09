"""
    core logic : gets job from queue, renders it, and sends it to storage
    other stuff : sends a heartbeat to the server every 10 seconds to let it know it's alive,
                  gives the server a unique fingerprint of the device

"""

import redis,supabase,subprocess
import os,time,json,httpx,requests,zipfile
import platform,uuid,hashlib,threading

with open("config.json") as f:
    config = json.load(f)

SP_URL = config["SUPABASE_URL"]
SP_KEY = config["SUPABASE_KEY"]
REDIS_ENDPOINT = config["redis_endpoint"]
REDIS_PASSWORD = config["redis_password"]
BLENDER_PATH = config["BLENDER_PATH"]
USER_ID = config["user_id"]
SERVER = config["server"]
BLENDER_URL = "https://download.blender.org/release/Blender3.6/blender-3.6.0-windows-x64.zip"

mid = None

REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_ENDPOINT}"


red = redis.from_url(REDIS_URL, decode_responses=True)
sp = supabase.create_client(SP_URL,SP_KEY)


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
        sp.table("device").update({"status":"processing","last_job_id":data["job_id"]}).eq("machine_id",mid).execute()
        user_id = sp.table("job").select("user_id").eq("job_id", data["job_id"]).execute().data[0]["user_id"]
        filename = sp.table("job").select("name").eq("job_id", data["job_id"]).execute().data[0]["name"]
        sub_cnt = sp.table("job").select("alive_cnt").eq("job_id", data["job_id"]).execute().data[0]["alive_cnt"]
        sp.table("job").select({"alive_cnt":sub_cnt+1}).eq("job_id", data["job_id"]).execute()
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
            httpx.get(f"{SERVER}/heartbeat/{mid}")
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
    os.remove("./workplace/work.blend")
    sp.table("device").update({"status":"free","last_job_id":None}).eq("machine_id",mid).execute()
    return {"message": "File uploaded successfully"}

def report_job_done(job):
    # in the job table update alive -= 1 @job_id
    # if alive == 0 then report to api route /job_complete/{job_id}

    sp.table("subtask").update({"status": "done"}).eq("job_id", job.job_id).eq("subtask_id", job.subtask_id).execute()
    sp.rpc("decrement_alive_cnt", {"jid": job.job_id}).execute()

    if (sp.table("job").select("alive_cnt").eq("job_id", job.job_id).execute().data[0]["alive_cnt"] == 0):
        return httpx.post(f"{SERVER}/job_complete/{job.job_id}",timeout=None)
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

def ensure_blender():
    if os.path.exists("./blender/blender.exe"):
        return

    print("Downloading Blender...")

    os.makedirs("blender", exist_ok=True)

    zip_path = "blender.zip"

    r = requests.get(BLENDER_URL, stream=True)
    with open(zip_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall("./blender")

    os.remove(zip_path)

def main():
    global mid
    mid = httpx.post(f"{SERVER}/register/machine/",json={"finger_print":get_device_fingerprint(),"user_id":USER_ID}).json()
    mid = mid["machine_id"]
    threading.Thread(target=send_heartbeat, daemon=True).start()
    ensure_blender()

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
        
        user_id = sp.table("job").select("user_id").eq("job_id", job.job_id).execute().data[0]["user_id"]
        
        send_to_storage(rendered_job, user_id)
        report_job_done(job)
        

if __name__ == "__main__":
    main()