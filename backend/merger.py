"""
    core function: merges all the subtasks @job_id and put it in output @user_id if server request it
    other functions: --nil--

"""

import fastapi,supabase,os,httpx,dotenv,subprocess

dotenv.load_dotenv()

SP_URL = os.getenv("SUPABASE_URL")
SP_KEY = os.getenv("SUPABASE_KEY")

sp = supabase.create_client(SP_URL, SP_KEY)
app = fastapi.FastAPI()

@app.post("/merge/{job_id}")
def merge_job(job_id):
    output_path = "./mergespace/"
    
    result = sp.table("job").select("user_id, name").eq("job_id", job_id).execute()  # single query
    if not result.data:
        return {"error": f"No job found for job_id={job_id}"}

    user_id = result.data[0]["user_id"]
    name = result.data[0]["name"]
    
    output = sp.storage.from_("RFV2").list(f"users/{user_id}/subtasks/")
    output.sort(key=lambda x: x['name'])

    with open(output_path + "list.txt", "wb") as f:
        for file in output:
            signed = sp.storage.from_('RFV2').create_signed_url(
                f"users/{user_id}/subtasks/{file['name']}",
                3600
            )
            url = signed['signedURL']
            f.write(f"file '{url}'\n".encode('utf-8'))

    subprocess.run([
        './dependencies/ffmpeg.exe',
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
        '-f', 'concat',
        '-safe', '0',
        '-i', output_path + 'list.txt',
        '-c', 'copy',
        output_path + name + '.mp4'
    ])

    return {"message": "Reached the merger", "output_file":f"{output_path}{name}.mp4"}