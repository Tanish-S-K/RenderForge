# RenderForge 🔥

A distributed Blender render farm that splits rendering jobs across multiple agents, dramatically reducing render times through parallelization.

🔗 **[Live Demo](https://render-forge.vercel.app/)** • Open Source

---

## What is RenderForge?

RenderForge lets you render Blender `.blend` files across multiple machines simultaneously. Instead of one machine rendering all frames sequentially, RenderForge splits the frame range across as many agents as you have, renders them in parallel, and automatically merges the output into a single `.mp4` file.

**Example:** A 300-frame render that takes 60 minutes on one machine takes ~15 minutes with 4 agents.

---

## How it works

```
User uploads .blend file via Frontend
            ↓
Backend splits frame range into chunks
            ↓
Chunks pushed to Redis job queue
            ↓
Agents (on any machine) pull chunks and render
            ↓
Each agent uploads rendered .mp4 chunk to Supabase
            ↓
Backend merges all chunks → final output.mp4
            ↓
User downloads finished render
```

---

## Architecture

![Architecture Diagram](https://raw.githubusercontent.com/Tanish-S-K/RenderForge/abba15e0c40def88a0a33502fc71ddf2fcdc54c4/blog/artifacts/Design_V2.jpg)

### Components

| Component | Technology | Role |
|---|---|---|
| Frontend | Web UI | Job submission, agent setup, render monitoring |
| Backend | Python + FastAPI | Job orchestration, chunking, merging |
| Queue | Redis | Distributes render chunks to agents |
| Storage | Supabase Storage | Stores `.blend` files, chunks, final output |
| Database | Supabase (Postgres) | Job metadata, user data, task tracking |
| Agents | Python + Blender | Pull chunks from queue and render them |

### Security

Agents never hold long-lived credentials. When an agent picks up a task, the backend issues a **short-lived token** scoped to that task only. The token expires when the task completes.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Blender installed on agent machines
- A Supabase project
- A Redis instance (Upstash, Redis Cloud, or self-hosted)

### Backend Setup

```bash
git clone https://github.com/yourname/renderforge
cd renderforge/backend

pip install -r requirements.txt

# Set environment variables on your hosting platform
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
REDIS_URL=your_redis_url
REDIS_PASSWORD=your_redis_password

uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd renderforge/frontend
npm install
npm run dev
```

Point `VITE_API_URL` (or equivalent) to your backend URL.

---

## Adding an Agent

Adding a new render agent takes under a minute:

1. Go to the **Add Agent** page in the frontend
2. Click **Download Agent** — downloads the agent package
3. Click **Download Config** — downloads a pre-filled `config.json` tied to your account
4. Unzip the agent package and drop `config.json` into the folder
5. Double-click `start.bat`

The agent will immediately connect and start picking up render jobs. You can add as many agents as you want across any number of machines.

> **Note:** Agents work on Windows. Linux/Mac support coming soon.

---

## API Reference

### Jobs

#### `POST /jobs`
Submit a new render job.

**Request:**
```json
{
  "name": "my_render",
  "blend_file_path": "users/{user_id}/uploads/scene.blend",
  "start_frame": 1,
  "end_frame": 300,
  "fps": 24
}
```

**Response:**
```json
{
  "job_id": "516209dc-fc33-4130-9bbe-42598e4d1489",
  "status": "queued",
  "chunks": 10
}
```

---

#### `GET /jobs/{job_id}`
Get status of a render job.

**Response:**
```json
{
  "job_id": "516209dc-fc33-4130-9bbe-42598e4d1489",
  "name": "my_render",
  "status": "rendering",
  "progress": "6/10 chunks done",
  "output_url": null
}
```

Status values: `queued` → `rendering` → `merging` → `done` | `failed`

---

#### `POST /merge/{job_id}`
Manually trigger merge of completed chunks into final `.mp4`. Usually called automatically by the backend when all chunks are done.

**Response:**
```json
{
  "message": "Merge complete",
  "output_url": "https://your-bucket.supabase.co/..."
}
```

---

### Agents

#### `POST /agent/register`
Called by agent on startup to register itself and receive a session token.

#### `POST /agent/task-token`
Called by agent when picking up a task. Returns a short-lived scoped token for that task only.

#### `POST /agent/heartbeat`
Called periodically by agent to signal it is alive and working.

---

## Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch — `git checkout -b feature/my-feature`
3. Make your changes
4. Open a pull request with a clear description of what you changed and why

### Good first issues

- Linux/Mac agent support (`start.sh` equivalent of `start.bat`)
- PNG frame pipeline (render to PNG frames instead of MP4 chunks for cleaner merging)
- Agent GPU selection (choose which GPU to render on per agent)
- Progress websocket (real-time frame progress instead of polling)

### Code style

- Python: follow PEP8, use type hints
- Keep agent code dependency-light — it runs on user machines

---

## License

MIT

---

*Created by [Tanish S K](https://github.com/Tanish-S-K) during college.*