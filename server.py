import threading
import time
import asyncio
import os
from io import BytesIO
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
import cv2
from groq import Groq
from dotenv import load_dotenv

# Initialize and inject configurations from your local .env file securely
load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Pull the token directly from the local environment dictionary matrix
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

if not groq_client:
    print("⚠️ WARNING: GROQ_API_KEY could not be mapped out from your local .env configuration environment.")

# Global state metrics shared across threaded processes
latest_frame = None
latest_objects = []
latest_stats = {"inference_ms": 0.0, "fps": 0.0}
frame_lock = threading.Lock()
capture_running = threading.Event()
capture_running.set()


def capture_loop(source=0, model_path="yolo11n.pt"):
    global latest_frame, latest_objects
    model = YOLO(model_path)
    cap = None  # Lazy initialize to allow cold hardware shutdowns
    
    img_w, img_h = 640, 480  # Baseline fallback frame metrics

    last_time = time.time()
    frame_count = 0

    while True:
        # 1. HARDWARE MANAGEMENT DEALLOCATION
        if not capture_running.is_set():
            if cap is not None:
                cap.release()  # PHYSICAL TERMINATION: Kills laptop camera green sensor light cleanly
                cap = None
            
            with frame_lock:
                latest_frame = None
                latest_objects = []
                
            time.sleep(0.2)
            continue

        # 2. SEAMLESS RE-INITIALIZATION LOOP LOCK
        if cap is None:
            cap = cv2.VideoCapture(source)
            if not cap.isOpened():
                time.sleep(0.5)
                continue
            
            img_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) if cap.get(cv2.CAP_PROP_FRAME_WIDTH) else 640
            img_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) if cap.get(cv2.CAP_PROP_FRAME_HEIGHT) else 480

        # 3. STREAM READ AND INFERENCE MATCHING
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue

        import contextlib
        with open(os.devnull, 'w') as devnull:
            with contextlib.redirect_stdout(devnull):
                with contextlib.redirect_stderr(devnull):
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
                name = model.names[cls]
                
                xyxy = box.xyxy[0].tolist()
                bx_w = xyxy[2] - xyxy[0]
                bx_h = xyxy[3] - xyxy[1]
                center_x = xyxy[0] + (bx_w / 2)
                
                # Spatial quadrant slicing
                if center_x < img_w / 3:
                    position = "left"
                elif center_x > 2 * img_w / 3:
                    position = "right"
                else:
                    position = "center"
                
                # Focal index steps away approximation 
                height_ratio = bx_h / img_h
                if height_ratio > 0.7:
                    steps = 2
                elif height_ratio > 0.4:
                    steps = 4
                elif height_ratio > 0.2:
                    steps = 8
                else:
                    steps = 15

                objects.append({
                    "name": name,
                    "confidence": round(conf, 2),
                    "position": position,
                    "steps_away": steps
                })
            except Exception:
                continue

        ret2, jpeg = cv2.imencode('.jpg', annotated)
        if not ret2:
            continue

        with frame_lock:
            latest_frame = jpeg.tobytes()
            latest_objects = objects
            latest_stats['inference_ms'] = round(inference_ms, 1)

        frame_count += 1
        now = time.time()
        if now - last_time >= 1.0:
            fps = frame_count / (now - last_time)
            with frame_lock:
                latest_stats['fps'] = round(fps, 1)
            frame_count = 0
            last_time = now

        time.sleep(0.01)


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


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    last_scene_time = 0.0
    cached_scene_context = "Scanning layout framework..."
    
    try:
        while True:
            with frame_lock:
                current_objs = latest_objects
                stats = latest_stats.copy()
            
            now = time.time()
            
            # DUAL-FREQUENCY MACRO ENVIRONMENT LOOP (Fires strictly every 10 seconds)
            if now - last_scene_time >= 10.0 or last_scene_time == 0.0:
                last_scene_time = now
                unique_items = list(set([obj['name'] for obj in current_objs]))
                items_string = ", ".join(unique_items) if unique_items else "clear space"
                
                scene_prompt = (
                    f"Analyze these environment tokens: {items_string}. "
                    "In exactly 4 to 7 words, identify the macro environment or room layout. "
                    "Examples: 'Inside a residential living room', 'Walking down an open city street'. "
                    "Keep it strictly brief, descriptive, and clean. No formatting or commentary."
                )
                
                try:
                    if groq_client:
                        completion = await asyncio.to_thread(
                            groq_client.chat.completions.create,
                            messages=[{"role": "user", "content": scene_prompt}],
                            model="llama-3.1-8b-instant",
                            temperature=0.2,
                            max_tokens=25
                        )
                        cached_scene_context = completion.choices[0].message.content.strip()
                    else:
                        cached_scene_context = "Groq configuration unmapped. Active tracker running."
                except Exception as e:
                    print(f"Groq API Scene Exception Details: {e}")
                    cached_scene_context = "Navigating active environment structure"

            # Push telemetry object vectors instantaneously over the running websocket channel
            await websocket.send_json({
                "objects": current_objs, 
                "stats": stats,
                "description": cached_scene_context
            })
            await asyncio.sleep(0.03)
            
    except WebSocketDisconnect:
        pass