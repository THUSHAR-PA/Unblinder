# Unblinder

**An AI walking assistant for visually impaired pedestrians.**

It watches the path ahead through your phone's camera, spots obstacles, and speaks one calm briefing: what's in the way, then which way to turn.

---

## What it does

| | |
|---|---|
| 🧭 **Guide me** | Fuses obstacles with your route into one spoken briefing — hazards first, then the next turn and its distance. |
| 👁 **Objects** | Looks at the path *right now* and describes what's in front of you, nearest first. Speaks once. Nothing re-scans on its own. |
| 🌤 **Weather** | Turns conditions into plain advice, for someone who can't see the sky. |
| ✨ **Assistant** | Ask anything out loud. It sees the actual frame — so it can warn about a pothole, or **read a sign aloud**. Say *"take me to Cubbon Park"* and it sets the route itself. |

Destinations accept a place name, raw coordinates, or a pasted Google Maps link (short `maps.app.goo.gl` links included).

---

## Quickstart

You need Python 3.10+, Node, and a [Groq key](https://console.groq.com/keys). The model is committed — nothing to download.

**Backend**

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # set GROQ_API_KEY
uvicorn server:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev                        # → http://localhost:5173
```

That's it. Open the page, allow the camera, press **Engage Camera Sensor**.

---

## How it works

```
                                  FAST PATH — every frame, local, free
 camera ──JPEG frames──▶  /ws  ──▶  YOLO11 (ONNX Runtime)
    ▲                                  │
    └───── labels + boxes ─────────────┤
                                       ▼   ON DEMAND — only when you ask
                             Fireworks VLM ──▶ hazards, signs, scene

 OpenStreetMap ──▶ route ──┐
                           ├──▶ Groq ──▶ spoken briefing
 detections ───────────────┘
```

**The camera lives in the browser, not the server.** On a phone that means the rear camera is the one facing the path — and the app works deployed, instead of only on the laptop the server runs on.

**Two tiers of sight.** YOLO is fast and precise but only knows COCO's 80 classes. A VLM is slow and gives no coordinates, but sees an open-ended scene. They aren't substitutes, so both run. YOLO drives the overlay and the safety warnings; the VLM catches what has no class — potholes, kerbs, steps, puddles, signs.

**The VLM only runs when asked.** Pressing Objects, or asking the assistant a question. There is no background loop: a camera streaming for an hour with nobody pressing anything makes zero VLM calls and costs nothing. An earlier version re-analyzed every few seconds and spoke the result, which meant the app narrated continuously at a user who then had to talk over it.

**Proximity warnings are edge-triggered.** Something inside 3 steps is announced without being asked — but *once*, on the way in. It then latches, so standing next to a bollard is silent rather than a loop. The latch clears only when the object actually leaves the frame, so a second warning always means something new: it came back. A 2-second grace period absorbs YOLO dropping a box for a frame, which would otherwise read as "left and returned" and re-fire.

**One frame in flight at a time.** The next frame is sent only when the last one's detections return. A slow server lowers the frame rate instead of queueing stale frames — a warning that arrives two seconds late is worse than none.

**ONNX Runtime, not torch.** Torch sits at ~400MB before doing any work and gets OOM-killed on a small instance. The same model runs in ~200MB. `detector.py` does the letterboxing and NMS that ultralytics would otherwise hide.

**Distance is a guess.** It's estimated from apparent box height. Monocular vision has no depth — "4 steps away" is informed, not measured.

---

## Configuration

| Variable | Required | What it does |
|---|---|---|
| `GROQ_API_KEY` | **yes** | Briefing, weather, and text-only fallbacks |
| `FIREWORKS_API_KEY` | no | Turns on the VLM. Without it, the app never sees the image |
| `FIREWORKS_VLM_MODEL` | no | Default `accounts/fireworks/models/kimi-k2p6` |

Everything degrades gracefully: no Fireworks key, or any API failure, and it silently falls back to labels only. The server prints which path it's on at startup:

```
[vision] Fireworks VLM enabled: accounts/fireworks/models/kimi-k2p6 (on demand only)
[vision] disabled (no FIREWORKS_API_KEY): scene summary is YOLO labels only
```

---

## Deploying

Two services from one repo.

**Backend** — Render Web Service

| Setting | Value |
|---|---|
| Build | `pip install -r requirements.txt` |
| Start | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
| Env | `GROQ_API_KEY` (+ `FIREWORKS_API_KEY`) |

Runs in ~200MB, so 512MB is enough. The VLM is a hosted call, so it costs no memory.

**Frontend** — Render Static Site

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build | `npm install && npm run build` |
| Publish directory | `dist` |
| Env | `VITE_BACKEND_URL` = the backend's URL |

---

## Gotchas

Things that will cost you an afternoon if you don't know them.

- **Camera needs HTTPS.** Browsers only allow it on `localhost` or a secure origin.
- **Voice input needs Chromium.** The Web Speech API isn't in Firefox/Safari yet.
- **`VITE_BACKEND_URL` is baked in at build time.** Changing it needs a rebuild, not a restart.
- **A text-only VLM will lie to you.** `FIREWORKS_VLM_MODEL` must have `supports_image_input: true` in `/v1/models`. Most of the catalogue is text-only and **ignores the image without erroring** — a confident answer about a photo it never saw.
- **`reasoning_effort: "none"` is load-bearing.** Kimi is a reasoning model; left on, it streams its chain-of-thought into `content` with nothing to strip it by, so text-to-speech reads the model thinking out loud — and it burns the token budget before reaching an answer. Off: ~22 clean tokens instead of 400+ useless ones. JSON mode doesn't suppress it. Neither does `"low"`.
- **Cost is bounded by presses, not by time.** The VLM is called only when you tap Objects or ask the assistant something. Streaming the camera all day with nobody pressing anything costs **zero**. Detection and Guide Me never call it at all.

---

## API

| Route | Purpose |
|---|---|
| `WS /ws` | Send JPEG frames, receive detections |
| `POST /api/scene` | One-shot look at the current frame — this is the Objects button |
| `GET /api/resolve` | Destination → coordinates (name, coordinates, or Maps link) |
| `GET /api/route` | Walking route and turn-by-turn checkpoints |
| `POST /api/briefing` | Obstacles + navigation → one spoken briefing |
| `POST /api/ai_assist` | Answers a spoken question; may return a `navigate` intent |
| `GET /api/weather` | Conversational weather report |

Interactive docs at `/docs`.

---

## Layout

```
server.py         FastAPI — frame socket, VLM, navigation, weather, reasoning
detector.py       YOLO11 on ONNX Runtime — letterboxing, NMS, box mapping
detect.py         standalone webcam script, for sanity-checking the model
yolo11n.onnx      the exported model
frontend/src/
  App.jsx         dashboard — video, overlay, map, voice, controls
  styles.css      theme tokens and component styles
```

Colours are defined once as CSS variables. Flipping `data-theme` on `<html>` repaints the whole console — no component holds a colour of its own.

To re-export the model or run `detect.py`, install `requirements-dev.txt` (adds ultralytics). The server never imports torch.
