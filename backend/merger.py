"""
    core function: merges all the subtasks @job_id and put it in output @user_id if server request it
    other functions: --nil--

"""

@app.routes("/merge/{job_id}")
def merge_job(job_id):
    # use some means to join all the subtasks
    # upload the output to storage with job.name @job_id
    pass