import threading
import time
import asyncio
from io import BytesIO
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from ultralytics import YOLO
import cv2

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Globals shared between capture thread and request handlers
latest_frame = None
latest_objects = []
latest_stats = {"inference_ms": 0.0, "fps": 0.0}
frame_lock = threading.Lock()
capture_running = threading.Event()
capture_running.set()


def capture_loop(source=0, model_path="yolo11n.pt"):
    global latest_frame, latest_objects
    model = YOLO(model_path)
    cap = cv2.VideoCapture(source)
    import sys
    import contextlib

    # simple FPS counter
    last_time = time.time()
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue

        if not capture_running.is_set():
            time.sleep(0.1)
            continue

        # suppress model stdout/stderr to reduce console spam
        with contextlib.redirect_stdout(open('/dev/null', 'w')):
            with contextlib.redirect_stderr(open('/dev/null', 'w')):
                t0 = time.time()
                results = model(frame)
                t1 = time.time()
        inference_ms = (t1 - t0) * 1000.0

        try:
            annotated = results[0].plot()
        except Exception:
            annotated = frame

        objects = []
        for box in results[0].boxes:
            try:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                objects.append({
                    "name": model.names[cls],
                    "confidence": round(conf, 2)
                })
            except Exception:
                continue

        # encode JPEG
        ret2, jpeg = cv2.imencode('.jpg', annotated)
        if not ret2:
            continue

        with frame_lock:
            latest_frame = jpeg.tobytes()
            latest_objects = objects
            latest_stats['inference_ms'] = round(inference_ms, 1)

        # update fps
        frame_count += 1
        now = time.time()
        if now - last_time >= 1.0:
            fps = frame_count / (now - last_time)
            with frame_lock:
                latest_stats['fps'] = round(fps, 1)
            frame_count = 0
            last_time = now

        # small sleep to avoid pegging CPU
        time.sleep(0.02)


@app.on_event("startup")
def start_capture():
    thread = threading.Thread(target=capture_loop, daemon=True)
    thread.start()


def mjpeg_generator():
    boundary = b"frame"
    while True:
        with frame_lock:
            frame = latest_frame
        if frame is None:
            time.sleep(0.05)
            continue

        yield b"--%b\r\n" % boundary
        yield b"Content-Type: image/jpeg\r\n\r\n"
        yield frame
        yield b"\r\n"
        time.sleep(0.03)


@app.get("/video_feed")
def video_feed():
    return StreamingResponse(mjpeg_generator(), media_type='multipart/x-mixed-replace; boundary=frame')


@app.post('/camera/stop')
def stop_camera():
    capture_running.clear()
    return {"status": "stopped"}


@app.post('/camera/start')
def start_camera():
    capture_running.set()
    return {"status": "running"}


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_json(self, websocket: WebSocket, data):
        try:
            await websocket.send_json(data)
        except Exception:
            self.disconnect(websocket)

    async def broadcast_json(self, data):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # send latest objects + stats
            with frame_lock:
                objs = latest_objects
                stats = latest_stats.copy()
            await manager.send_json(websocket, {"objects": objs, "stats": stats})
            # wait for ~30 FPS
            await asyncio.sleep(0.03)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get('/')
def index():
   
    html = """
    <html>
      <head>
        <title>Unblinder Stream</title>
      </head>
      <body>
        <h1>Video</h1>
        <img src="/video_feed" />
        <h2>WebSocket objects</h2>
        <pre id="objs"></pre>
        <script>
          const ws = new WebSocket(`ws://${location.host}/ws`);
          const pre = document.getElementById('objs');
          ws.onmessage = (ev) => { pre.textContent = JSON.stringify(JSON.parse(ev.data), null, 2); };
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html)
