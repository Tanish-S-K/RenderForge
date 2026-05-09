"use client";

import Link from "next/link";
import { useState } from "react";
import {useRouter} from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleformsubmit = async (e) => {
    e.preventDefault();

    const response = await fetch("http://localhost:8000/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("session_id", data.session);
      localStorage.setItem("user_id", data.user_id);
      router.push("/dashboard");
    } else {
      alert("Invalid email/password");
    }
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

          <h1 className="flex justify-center">Register</h1>

          <form onSubmit={handleformsubmit} className="flex flex-col pt-3">

            <label>Email :</label>

            <input
              type="text"
              className="bg-gray-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label>Password :</label>

            <input
              type="password"
              className="bg-gray-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit">
              Register
            </button>

            <div className="text-xs">
              <p>Already have an account?</p>
              <a href="./login">Login</a>
            </div>

          </form>

        </div>

      </div>
    </>
  );
}