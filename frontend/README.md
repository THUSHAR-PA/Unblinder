# Unblinder — React dashboard + live camera stream

This project runs a Python backend (FastAPI) that captures webcam frames, runs a YOLO model (`yolo11n.pt`) to annotate frames, and exposes:

- `/video_feed` — MJPEG stream of annotated frames
- `/ws` — WebSocket streaming JSON detection objects

The `frontend/` directory contains a minimal Vite + React dashboard that displays the MJPEG stream and a live list of detected objects.

Quick start (macOS):

1. Activate your Python venv (created earlier):

```bash
source .venv/bin/activate
```

2. Install Python requirements (if you haven't already):

```bash
pip install -r requirements.txt
```

3. Run the FastAPI server:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

4. In another terminal, start the frontend dev server (requires Node.js & npm):

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (usually http://localhost:5173) to see the dashboard. You can also open http://localhost:8000/ to view the simple HTML preview served by the backend.

Notes:
- If your webcam device is different, edit `server.py` and change `capture_loop(source=0)` to the desired source path or index.
- Ensure `yolo11n.pt` is in the same folder as `server.py`.
