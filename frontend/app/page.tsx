"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0] flex flex-col">
      {/* Nav */}
      <nav className="flex justify-between items-center px-10 py-5 border-b border-white/5">
        <span className="font-mono font-bold text-violet-400 tracking-widest text-sm">RF</span>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm text-white/40 hover:text-white/80 transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-violet-500 hover:bg-violet-400 text-[#0a0a0f] px-4 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-3xl mx-auto w-full">
        <div className="text-xs font-semibold tracking-[0.15em] uppercase text-violet-400 border border-white/10 bg-white/[0.03] px-4 py-1.5 rounded-full mb-10">
          Distributed GPU Rendering
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] text-white mb-6">
          Render faster.<br />
          <span className="text-violet-400">Together.</span>
        </h1>

        <p className="text-lg text-white/30 max-w-md leading-relaxed mb-10">
          Upload your Blender project. Our distributed network splits, renders,
          and delivers your frames — automatically.
        </p>

        <div className="flex gap-4 flex-wrap justify-center mb-20">
          <Link
            href="/register"
            className="font-semibold bg-violet-500 hover:bg-violet-400 text-[#0a0a0f] px-6 py-3 rounded-lg transition-colors text-sm"
          >
            Start rendering
          </Link>
          <Link
            href="/login"
            className="font-medium text-white/40 hover:text-white/80 border border-white/10 hover:border-white/20 px-6 py-3 rounded-lg transition-colors text-sm"
          >
            Sign in
          </Link>
        </div>

        {/* Features */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5 border border-white/5 rounded-xl overflow-hidden">
          {[
            { icon: "⚡", title: "Parallel rendering", desc: "Jobs are split across all available machines automatically." },
            { icon: "🔁", title: "Fault tolerant", desc: "If a node drops, its frames are instantly re-queued." },
            { icon: "📦", title: "One output", desc: "Frames are merged into a single MP4, ready to download." },
          ].map((f) => (
            <div key={f.title} className="bg-white/[0.02] p-7 text-left">
              <span className="text-2xl block mb-3">{f.icon}</span>
              <h3 className="text-sm font-semibold text-white/70 mb-1.5">{f.title}</h3>
              <p className="text-sm text-white/25 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-10 py-5 border-t border-white/5 flex justify-between items-center">
        <span className="font-mono text-xs text-white/15">RenderForge</span>
        <span className="text-xs text-white/15">Contact us</span>
      </footer>
    </div>
  );
}
