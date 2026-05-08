"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Job = {
  id: number;
  job_name: string;
  date_posted: string;
  download_link: string;
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

  useEffect(() => {
    fetchJobs();
    fetchMachines();
  }, []);

  const fetchJobs = async () => {
    const res = await fetch("http://localhost:8000/jobs", {
      headers: {
        Authorization: "Bearer YOUR_TOKEN",
      },
    });

    const data = await res.json();

    setJobs(data);
  };

  const fetchMachines = async () => {
    const res = await fetch("http://localhost:8000/machines", {
      headers: {
        Authorization: "Bearer YOUR_TOKEN",
      },
    });

    const data = await res.json();

    setMachines(data);
  };

  return (
    <div>
      <div className="flex justify-between p-4 border-b">
        <Link href="/">Home Page</Link>

        <div className="flex gap-4">
          <Link href="/login">Username</Link>
          <Link href="/register">Logout</Link>
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
                    <a href={job.download_link}>
                      Download
                    </a>
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
            <form className="mt-6 flex flex-col gap-4 max-w-md">
              <input
                type="text"
                placeholder="Job Name"
                className="border p-2"
              />

              <input
                type="file"
                className="border p-2"
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
                <th>Machine Name</th>
                <th>Date Opened</th>
                <th>No Of Jobs</th>
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
            <form className="mt-6 flex flex-col gap-4 max-w-md">
              <input
                type="text"
                placeholder="Machine Name"
                className="border p-2"
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
    </div>
  );
}