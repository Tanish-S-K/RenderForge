"use client";

import Link from "next/link";

export default function Home() {

  const handleformsubmit = (e) => {
    e.preventDefault();
    console.log("Login");
  };

  return (
    <>
    <div className="flex justify-between p-4">
      <Link href="./">Home Page</Link>
      <div className="flex space-x-4">
        <Link href="./login">Login</Link>
        <Link href="./register">Register</Link>
      </div>
    </div>
    <div className="flex flex-col justify-center pt-10 items-center">
      
      <div className="border-4 p-5">
        <h1 className="flex justify-center">Login</h1>
        
        <form onSubmit={handleformsubmit} className="flex flex-col pt-3">
          <label>Email :</label><input type="text" name="email" className="bg-gray-300"></input>
          <label>Password :</label><input type="text" name="password" className="bg-gray-300"></input>
          <div className="text-xs"><p>Don't have an account?</p> <a href="./register"> Register</a></div>
        </form>
      </div>
    </div>
    </>
  );
}
