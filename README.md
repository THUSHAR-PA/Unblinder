# Unblinder

An AI walking assistant for visually impaired pedestrians. It watches the path ahead through the user's camera, detects obstacles with YOLO, fuses them with OpenStreetMap walking directions, and speaks a single calm, safety-first briefing through text-to-speech.

The camera runs **in the browser**, not on the server — so on a phone, the rear camera is the one pointed at the path, and the whole thing works when deployed to the cloud.

## How it works

```
browser camera ──JPEG frames──▶  /ws  ──▶ YOLO (yolo11n)
     ▲                                        │
     └────────── detections + boxes ──────────┘

OpenStreetMap (Nominatim + OSRM) ──▶ route ──┐
                                              ├──▶ Groq LLM ──▶ spoken briefing
live obstacle detections ─────────────────────┘
```

The frontend captures frames, downscales them to 640px, and streams them over a WebSocket. The backend runs detection and sends back labels plus normalized bounding boxes, which the browser draws over the live video. Only one frame is in flight at a time, so a slow server lowers the frame rate rather than building a backlog of stale frames.

## API

| Route | Purpose |
|---|---|
| `GET /` | Service info page |
| `WS /ws` | Send JPEG frames, receive detections |
| `POST /api/briefing` | Fuses obstacles + navigation into one spoken briefing ("Guide Me") |
| `POST /api/ai_assist` | Answers a spoken question, grounded in what the camera sees |
| `GET /api/weather` | Conversational weather report for someone who can't see the sky |
| `GET /api/geocode` | Destination string → coordinates |
| `GET /api/route` | Walking route + turn-by-turn checkpoints |

Interactive docs are at `/docs`.

## Setup

You need Python 3.10+, Node.js, and a [Groq API key](https://console.groq.com/keys).

**Model weights** are not committed. Download `yolo11n.pt` from the [Ultralytics releases](https://github.com/ultralytics/assets/releases) and put it next to `server.py`. (Ultralytics will also fetch it automatically on first run.)

**Backend:**

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env           # then set GROQ_API_KEY
uvicorn server:app --reload --port 8000
```

Without a `GROQ_API_KEY` the server still runs, but the briefing, assistant, and scene summary degrade to plain fallbacks.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (usually http://localhost:5173). The dashboard talks to `http://localhost:8000` by default; set `VITE_BACKEND_URL` to point it elsewhere.

Note that browsers only grant camera access on `localhost` or over HTTPS.

## Deploying

**Backend** — Render Web Service:

- Build: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu && pip install -r requirements.txt`
- Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Env: `GROQ_API_KEY`

Install torch from the CPU index as shown. A plain `pip install -r requirements.txt`
pulls the CUDA build of torch — several GB of NVIDIA libraries that a CPU instance
downloads and then never uses, which makes deploys crawl.

Torch and Ultralytics are heavy even so; the free instance type is not enough.

**Frontend** — Render Static Site:

- Root directory: `frontend`
- Build: `npm install && npm run build`
- Publish directory: `dist`
- Env: `VITE_BACKEND_URL` = your backend's URL

## Layout

- `server.py` — FastAPI backend: detection socket, navigation, weather, LLM reasoning
- `detect.py` — standalone local webcam script, for quickly sanity-checking the model
- `frontend/src/App.jsx` — the dashboard: video, overlay, map, voice, and controls
