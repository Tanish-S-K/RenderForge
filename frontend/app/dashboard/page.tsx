"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Job = {
  id: number;
  job_name: string;
  date_posted: string;
  download_link: string;
  status: string;
};

type Machine = {
  id: number;
  machine_name: string;
  date_opened: string;
  no_of_jobs: number;
};

const statusClass: Record<string, string> = {
  done:       "bg-emerald-950/70 text-emerald-400 border border-emerald-900/40",
  processing: "bg-violet-950/70 text-violet-400 border border-violet-900/40",
  pending:    "bg-amber-950/70 text-amber-400 border border-amber-900/40",
  free:       "bg-emerald-950/70 text-emerald-400 border border-emerald-900/40",
  inactive:   "bg-red-950/70 text-red-400 border border-red-900/40",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Dashboard() {
  const [tab, setTab] = useState<"jobs" | "machines">("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [token, setToken] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [showJobForm, setShowJobForm] = useState(false);
  const [showMachineSetup, setShowMachineSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [jobName, setJobName] = useState("");
  const [startFrame, setStartFrame] = useState(1);
  const [endFrame, setEndFrame] = useState(250);
  const [format, setFormat] = useState("png");
  const [jobFile, setJobFile] = useState<File | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("session_id");
    const email = localStorage.getItem("user_email") || "";
    if (!t) { window.location.replace("/login"); return; }
    setToken(t);
    setUserEmail(email);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchJobs(token), fetchMachines(token)]).finally(() => setLoading(false));
  }, [token]);

  async function fetchJobs(t: string) {
    try {
      const res = await fetch(`${API_URL}/jobs`, { headers: { Authorization: `Bearer ${t}` } });
      setJobs(await res.json());
    } catch {}
  }

  async function fetchMachines(t: string) {
    try {
      const res = await fetch(`${API_URL}/machines`, { headers: { Authorization: `Bearer ${t}` } });
      setMachines(await res.json());
    } catch {}
  }

  async function handleDownload(job_id: number) {
    const res = await fetch(`${API_URL}/public_link?job_id=${job_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    window.open(data.url, "_blank");
  }

  async function handleJobSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobFile) return alert("Please select a .blend file");
    setSubmitting(true);
    const user_id = localStorage.getItem("user_id") || "";
    const form = new FormData();
    form.append("user_id", user_id);
    form.append("name", jobName);
    form.append("start_frame", startFrame.toString());
    form.append("end_frame", endFrame.toString());
    form.append("format", format);
    form.append("file", jobFile);
    try {
      const res = await fetch(`${API_URL}/register/job/`, { method: "POST", body: form });
      const data = await res.json();
      alert(data.message);
      setShowJobForm(false);
      setJobName(""); setStartFrame(1); setEndFrame(250); setFormat("png"); setJobFile(null);
      fetchJobs(token);
    } catch { alert("Failed to submit job"); }
    finally { setSubmitting(false); }
  }

  async function downloadAgent() {
    const res = await fetch(`${API_URL}/download/agent`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return alert("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "RF-Agent.zip";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadConfig() {
    const res = await fetch(`${API_URL}/download/config`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "config.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function logout() { localStorage.clear(); window.location.href = "/login"; }

  const initials = userEmail ? userEmail[0].toUpperCase() : "U";

  const inputClass = "bg-white/[0.04] border border-white/10 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors w-full";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0] flex flex-col">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-4 border-b border-white/5 sticky top-0 bg-[#0a0a0f] z-10">
        <Link href="/" className="font-mono font-bold text-violet-400 tracking-widest text-sm">RF</Link>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-violet-950 text-violet-400 text-xs font-bold flex items-center justify-center">
            {initials}
          </div>
          <button
            onClick={logout}
            className="text-xs text-white/30 hover:text-white/70 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-52 border-r border-white/5 p-3 flex flex-col gap-1 shrink-0">
          {(["jobs", "machines"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left w-full transition-colors ${
                tab === t
                  ? "bg-violet-950/60 text-violet-300"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
              }`}
            >
              {t === "jobs" ? (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
              )}
              <span className="capitalize">{t === "jobs" ? "Render jobs" : "Machines"}</span>
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t ? "bg-violet-900/60 text-violet-400" : "bg-white/5 text-white/20"}`}>
                {t === "jobs" ? jobs.length : machines.length}
              </span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-white/20 text-sm">
              <span className="w-7 h-7 border-2 border-white/10 border-t-violet-500 rounded-full animate-spin" />
              Loading…
            </div>
          ) : tab === "jobs" ? (
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Render jobs</h2>
                  <p className="text-xs text-white/25 mt-0.5">{jobs.length} job{jobs.length !== 1 ? "s" : ""} total</p>
                </div>
                <button
                  onClick={() => setShowJobForm((v) => !v)}
                  className="bg-violet-500 hover:bg-violet-400 text-[#0a0a0f] font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  + New job
                </button>
              </div>

              {/* Job form */}
              {showJobForm && (
                <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6 mb-6">
                  <h3 className="text-sm font-semibold text-white/70 mb-5">Submit a new job</h3>
                  <form onSubmit={handleJobSubmit}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-wider">Job name</label>
                        <input className={inputClass} placeholder="my-animation" value={jobName}
                          onChange={(e) => setJobName(e.target.value)} required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-wider">Format</label>
                        <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value)}>
                          <option value="png">mp4</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-wider">Start frame</label>
                        <input type="number" className={inputClass} value={startFrame}
                          onChange={(e) => setStartFrame(Number(e.target.value))} required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-wider">End frame</label>
                        <input type="number" className={inputClass} value={endFrame}
                          onChange={(e) => setEndFrame(Number(e.target.value))} required />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-wider">.blend file</label>
                        <label className="border border-dashed border-white/10 hover:border-violet-500/50 rounded-lg px-4 py-3 cursor-pointer transition-colors flex items-center justify-center">
                          <input type="file" accept=".blend" className="hidden"
                            onChange={(e) => setJobFile(e.target.files?.[0] ?? null)} required />
                          <span className="text-sm text-white/25">
                            {jobFile ? jobFile.name : "Click to choose .blend file"}
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setShowJobForm(false)}
                        className="text-xs text-white/30 hover:text-white/60 border border-white/10 px-4 py-2 rounded-lg transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={submitting}
                        className="bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-[#0a0a0f] font-bold text-xs px-4 py-2 rounded-lg transition-colors">
                        {submitting ? "Submitting…" : "Submit job"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Jobs table */}
              {jobs.length === 0 ? (
                <div className="border border-dashed border-white/8 rounded-xl p-12 text-center text-sm text-white/20">
                  No jobs yet. Submit your first render above.
                </div>
              ) : (
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        {["#", "Name", "Date", "Status", ""].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/25 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job, i) => (
                        <tr key={job.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5 text-white/25 text-xs">{i + 1}</td>
                          <td className="px-4 py-3.5 text-white font-medium">{job.job_name}</td>
                          <td className="px-4 py-3.5 text-white/30 text-xs">{formatDate(job.date_posted)}</td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass[job.status] ?? statusClass.pending}`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {job.status === "done" && (
                              <button onClick={() => handleDownload(job.id)}
                                className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                                Download ↓
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Machines</h2>
                  <p className="text-xs text-white/25 mt-0.5">{machines.length} registered</p>
                </div>
                <button
                  onClick={() => setShowMachineSetup((v) => !v)}
                  className="bg-violet-500 hover:bg-violet-400 text-[#0a0a0f] font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  + Add machine
                </button>
              </div>

              {/* Machine setup */}
              {showMachineSetup && (
                <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6 mb-6 max-w-md">
                  <h3 className="text-sm font-semibold text-white/70 mb-5">Set up a new machine</h3>
                  <ol className="flex flex-col gap-3 mb-6">
                    {[
                      "Download the agent ZIP",
                      "Download your config file",
                      <>Extract the ZIP and place <code className="font-mono text-xs bg-white/8 border border-white/10 px-1.5 py-0.5 rounded text-violet-300">config.json</code> inside</>,
                      <>Double-click <code className="font-mono text-xs bg-white/8 border border-white/10 px-1.5 py-0.5 rounded text-violet-300">start.bat</code> to run</>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-white/40">
                        <span className="w-5 h-5 rounded-full bg-violet-950 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-3">
                    <button onClick={downloadAgent}
                      className="bg-violet-500 hover:bg-violet-400 text-[#0a0a0f] font-bold text-xs px-4 py-2 rounded-lg transition-colors">
                      Download agent
                    </button>
                    <button onClick={downloadConfig}
                      className="text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-4 py-2 rounded-lg transition-colors">
                      Download config
                    </button>
                  </div>
                </div>
              )}

              {/* Machines table */}
              {machines.length === 0 ? (
                <div className="border border-dashed border-white/8 rounded-xl p-12 text-center text-sm text-white/20">
                  No machines registered. Add one above to start contributing.
                </div>
              ) : (
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        {["#", "Machine ID", "Status", "Registered", "Last job"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/25 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {machines.map((m, i) => (
                        <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5 text-white/25 text-xs">{i + 1}</td>
                          <td className="px-4 py-3.5 font-mono text-xs text-white/40">{String(m.id).slice(0, 8)}…</td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass[m.machine_name] ?? statusClass.pending}`}>
                              {m.machine_name}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-white/30 text-xs">{formatDate(m.date_opened)}</td>
                          <td className="px-4 py-3.5 text-white/25 text-xs">{m.no_of_jobs ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
