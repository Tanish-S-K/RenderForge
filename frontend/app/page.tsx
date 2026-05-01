import "./globals.css";

export default function Home(){
  const user_id = "7f3c2b8e-6d1a-4a59-9c2f-3e8b1d7a4f6c"; // get this from the auth context
  
  return (
    <div>
      <h1>Give your job details</h1>

      <form 
        action="http://localhost:8000/register/job/" 
        method="post"
        encType="multipart/form-data"
        className="bg-black-700 flex flex-col items-center p-4 pt-10"
      >
        <input type="hidden" name="user_id" value={user_id} />

        <input name="name" placeholder="filename" /><br/>
        <input name="start_frame" placeholder="start_frame" /><br/>
        <input name="end_frame" placeholder="end_frame" /><br/>
        <input name="format" placeholder="format" /><br/>

        <input name="file" type="file" /><br/>

        <button type="submit">Submit</button>
      </form>
    </div>
  )
}