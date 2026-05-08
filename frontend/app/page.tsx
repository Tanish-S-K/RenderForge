"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex justify-between p-4">
      <Link href="./">Home Page</Link>
      <div className="flex space-x-4">
        <Link href="./login">Login</Link>
        <Link href="./register">Register</Link>
      </div>
    </div>
  );
}
