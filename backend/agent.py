"""
    core logic : gets job from queue, renders it, and sends it to storage
    other stuff : sends a heartbeat to the server every 10 seconds to let it know it's alive

"""

import time

# job structure:    id, subtask_id, name, object_id, start_frame, lenght, format, status, user_id, timestamp, machine_id.

def get_job():
    
    # if queue not empty:
        # get as job object
        # update status in table to "processing"
        # return job remove from the queue
    # return None
    pass

def send_heartbeat():

    # api route: /heartbeat/{machine_id}
    # post request to api route;

    pass

def render_job(job):
    
    # get storage url using job.object_id
    # download the file from storage
    # render the file using blender cli commands
    
    # rendering constraints:
        # -- file name = id+subtask_id
        # -- format = format
        # -- frames => (start_frame, start_frame+lenght)
    
    # any error return None
    pass

def send_to_storage(job):
    
    # get storge url using the object_id;
    # upload the file with name id+subtask_id to the storage;
    pass

def send_machine_failed(job):

    # api route: /machine_failed/{job_id}
    # post request to api route;
    pass

def main():
    
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
            send_heartbeat()
        
        rendered_job = render_job(job)
        
        if not rendered_job:
            send_machine_failed(job)
            continue

        send_to_storage(job)
        

if __name__ == "__main__":
    main()