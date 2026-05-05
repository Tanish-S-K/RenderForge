"""
    core function: login & registeration for machine and user
    other functions: ---
"""


import fastapi,dotenv,os,supabase
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

dotenv.load_dotenv()

SP_URL = os.getenv("SUPABASE_URL")
SP_KEY = os.getenv("SUPABASE_KEY")

app = fastapi.FastAPI()
sp = supabase.create_client(SP_URL,SP_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email : str
    password : str

class Machine_Request(BaseModel):
    finger_print: str
    user_id: str

@app.post("/login")
async def loginuser(data: LoginRequest):

    # authenticate with supabase
    # create session and return
    try:
        res = sp.auth.sign_in_with_password({"email":data.email,"password":data.password})
    except:
        return {"message":"try something else"}
        
    
    return {
        "token":res.session.access_token,
        "user_id": res.user.id
    }

@app.post("/signup")
async def register_user(data: LoginRequest):
    # signup with supabase
    # register in the database
    # create session and return

    res = sp.auth.sign_up({
        "email": data.email,
        "password": data.password
    })

    if res.user.id is None:
        return {"message": "Someproblem occured"}
    user_id = res.user.id

    sp.table("user").insert({"id":user_id}).execute()
    return {
        "token": res.session.access_token,
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
        return {"machine_id": machine_id}
    except Exception as e:
        return {"message": e}