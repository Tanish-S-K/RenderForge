"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function Home() {
  const [currentTab, setCurrentTab] = useState("job");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  const [showJobForm, setShowJobForm] = useState(false);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [token,setToken] = useState<String>("");

  const [jobName, setJobName] = useState("");
  const [startFrame, setStartFrame] = useState(1);
  const [endFrame, setEndFrame] = useState(250);
  const [format, setFormat] = useState("png");
  const [jobFile, setJobFile] = useState<File | null>(null);


  const downloadAgent = async () => {

    const token = localStorage.getItem("session_id");

    if (!token) {
      alert("No session");
      return;
    }

    const response = await fetch(
      "http://localhost:8000/download/agent",
      {
        headers: {
          Auth: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      alert("Download failed");
      return;
    }

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "RF-Agent.zip";

    document.body.appendChild(a);
    a.click();

    a.remove();

    window.URL.revokeObjectURL(url);
  };
  const downloadConfig = async () => {


    const token = localStorage.getItem("session_id");

    const response = await fetch(
      "http://localhost:8000/download/config",
      {
        headers: {
          Auth: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "config.json";

    a.click();

    window.URL.revokeObjectURL(url);
  };

  const logout = () => {

    localStorage.clear();

    window.location.href = "/login";
  };

  useEffect(() => {

    const storedToken =
      localStorage.getItem("session_id");
    
    if (storedToken) {
      setToken(storedToken);
      console.log(storedToken);
    } else{
      window.location.replace("/login");
    }

  }, []);

  useEffect(() => {

    if (token) {
      
      fetchJobs();
      fetchMachines();
    }

  }, [token]);

  const fetchJobs = async () => {
    const res = await fetch("http://localhost:8000/jobs", {
      headers: {
        Auth: `Bearer ${token}`,
      },
    });
    

    const data = await res.json();

    setJobs(data);
  };

  const fetchMachines = async () => {
    const res = await fetch("http://localhost:8000/machines", {
        headers: {
          Auth: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      setMachines(data);
    };
    const handleDownload = async (job_id: number) => {
      const token = localStorage.getItem("session_id");

      const res = await fetch(
        `http://localhost:8000/public_link?job_id=${job_id}`,
        {
          headers: {
            Auth: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      window.open(data.url, "_blank");
    };

    const handleJobSubmit = async (e: any) => {

    e.preventDefault();

    const user_id = localStorage.getItem("user_id");
    
    const formData = new FormData();

    formData.append("user_id", user_id || "");
    formData.append("name", jobName);

    formData.append(
      "start_frame",
      startFrame.toString()
    );

    formData.append(
      "end_frame",
      endFrame.toString()
    );

    formData.append("format", format);

    if (jobFile) {
      formData.append("file", jobFile);
    }

    const res = await fetch(
      "http://localhost:8000/register/job/",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    alert(data.message);

    fetchJobs();

    setShowJobForm(false);
  };

  return (
    <div>
      <div className="flex justify-between p-4 border-b">
        <Link href="/">Home Page</Link>

        <div className="flex gap-4">
          <Link href="/dashboard">Username</Link>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="flex">
        <button
          onClick={() => setCurrentTab("job")}
          className="flex-1 p-4 bg-gray-500"
        >
          Jobs ({jobs.length})
        </button>

        <button
          onClick={() => setCurrentTab("machine")}
          className="flex-1 p-4 bg-gray-400"
        >
          Machines ({machines.length})
        </button>
      </div>

      
      {currentTab === "job" && (
        <div className="p-6">
          <table className="w-full border">
            <thead>
              <tr className="border-b">
                <th>#</th>
                <th>Job Name</th>
                <th>Date Posted</th>
                <th>Download</th>
              </tr>
            </thead>

            <tbody>
              {jobs.map((job, index) => (
                <tr key={job.id} className="border-b text-center">
                  <td>{index + 1}</td>
                  <td>{job.job_name}</td>
                  <td>{job.date_posted}</td>

                  <td>
                    {job.status === "done"?
                    (<button onClick={() => handleDownload(job.id)} className="text-blue-600 underline">
                        Download
                      </button>
                    ):(
                      <span>{job.status}</span>
                    )}
                  </td>
                </tr>
              ))}

              
              <tr>
                <td colSpan={4}>
                  <button
                    onClick={() => setShowJobForm(true)}
                    className="w-full p-3 bg-green-500"
                  >
                    + Add Job
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

         
          {showJobForm && (
              <form
                onSubmit={handleJobSubmit}
                className="mt-6 flex flex-col gap-4 max-w-md"
              >

                <input
                  type="text"
                  placeholder="Job Name"
                  className="border p-2"
                  value={jobName}
                  onChange={(e) =>
                    setJobName(e.target.value)
                  }
                />

                <input
                  type="number"
                  placeholder="Start Frame"
                  className="border p-2"
                  value={startFrame}
                  onChange={(e) =>
                    setStartFrame(Number(e.target.value))
                  }
                />

                <input
                  type="number"
                  placeholder="End Frame"
                  className="border p-2"
                  value={endFrame}
                  onChange={(e) =>
                    setEndFrame(Number(e.target.value))
                  }
                />

                <input
                  type="text"
                  placeholder="Format"
                  className="border p-2"
                  value={format}
                  onChange={(e) =>
                    setFormat(e.target.value)
                  }
                />

                <input
                  type="file"
                  className="border p-2"
                  onChange={(e) => {

                    if (e.target.files) {
                      setJobFile(e.target.files[0]);
                    }

                  }}
                />

                <button
                  type="submit"
                  className="bg-black text-white p-2"
                >
                  Submit
                </button>

              </form>
          )}
        </div>
      )}

      
      {currentTab === "machine" && (
        <div className="p-6">
          <table className="w-full border">
            <thead>
              <tr className="border-b">
                <th>#</th>
                <th>Machine Status</th>
                <th>Date Opened</th>
                <th>Current Job ID</th>
              </tr>
            </thead>

            <tbody>
              {machines.map((machine, index) => (
                <tr
                  key={machine.id}
                  className="border-b text-center"
                >
                  <td>{index + 1}</td>
                  <td>{machine.machine_name}</td>
                  <td>{machine.date_opened}</td>
                  <td>{machine.no_of_jobs}</td>
                </tr>
              ))}

              
              <tr>
                <td colSpan={4}>
                  <button
                    onClick={() => setShowMachineForm(true)}
                    className="w-full p-3 bg-green-500"
                  >
                    + Add Machine
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          
          {showMachineForm && (
            <div className="p-6">

            <div className="mb-6 p-4 border bg-yellow-100">
              <h2 className="font-bold mb-2">
                Setup Instructions
              </h2>

              <ol className="list-decimal ml-5">
                <li>Download Agent ZIP</li>
                <li>Download Config File</li>
                <li>Extract ZIP</li>
                <li>Place config.json inside folder</li>
                <li>Run start.bat(By Double CLicking)</li>
              </ol>
            </div>

            <div className="flex flex-col gap-3 max-w-md">

              <button
                type="button"
                onClick={downloadAgent}
                className="bg-black text-white p-2"
              >
                Download Agent
              </button>

              <button
                type="button"
                onClick={downloadConfig}
                className="bg-gray-700 text-white p-2"
              >
                Download Config
              </button>

            </div>

          </div>
          )}
        </div>
      )}
    </div>
  );
}