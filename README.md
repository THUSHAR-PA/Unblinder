Markdown
# Unblinder — React dashboard + live camera stream

This project runs a Python backend (FastAPI) that captures webcam frames, runs a YOLO model (`yolo11n.pt`) to annotate frames, and exposes:

- `/video_feed` — MJPEG stream of annotated frames
- `/ws` — WebSocket streaming JSON detection objects

The `frontend/` directory contains a minimal Vite + React dashboard that displays the MJPEG stream and a live list of detected objects.

Quick start (macOS):

1. Activate your Python venv (created earlier):

```bash
source .venv/bin/activate
Install Python requirements (if you haven't already):

Bash
pip install -r requirements.txt
Run the FastAPI server:

Bash
uvicorn server:app --host 0.0.0.0 --port 8000
In another terminal, start the frontend dev server (requires Node.js & npm):

Bash
cd frontend
npm install
npm run dev
Open the Vite URL (usually http://localhost:5173) to see the dashboard. You can also open http://localhost:8000/ to view the simple HTML preview served by the backend.

Notes:

If your webcam device is different, edit server.py and change capture_loop(source=0) to the desired source path or index.

Ensure yolo11n.pt is in the same folder as server.py.

💻 Terminal Commands Reference & Groq Integration
Below are the exact terminal commands required to install the modern AI capabilities, troubleshoot workspace scope constraints, and initialize the enhanced codebase safely.

1. Groq SDK Engine Installation & Verification
Ensure your Python virtual environment (.venv) is actively engaged before launching these steps to pull down the cloud-inference packages:

Bash
# 1. Download and install the core Groq cloud inference engine client
pip install groq

# 2. Install the variable parsing helper library
pip install python-dotenv

# 3. Verify that the package tree compiled cleanly into your local workspace environment
pip show groq
Description: Installs the required client modules for cloud inference and configuration parsing. The final verification check prints out package metadata details to confirm the workspace environment is compiled cleanly.

2. Resolving the "Could not import module server" Directory Error
If your command prompt line path is sitting back at the parent directory (D:\Project\AMD_Hackathon), running your server directly will result in a path tracking failure. Step directly into your active subdirectory project boundaries first:

Bash
# Shift your active command console directly inside the core code folder
cd unblinder

# Boot up the backend interface engine smoothly from the correct path layer
uvicorn server:app --host 0.0.0.0 --port 8000
Description: Shifting into the specific subfolder maps the running terminal directory directly alongside server.py, which lets Uvicorn find and bind the FastAPI ASGI app module instantly.

3. Activating Live Server Hot-Reload (Recommended for Quick Testing)
To save yourself from having to manually kill your terminal screen and reboot your backend every single time you refine a prompt phrase, pass the active monitoring parameters:

Bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
Description: Tells the ASGI engine to automatically reload within fractions of a second the very instant you save code changes in server.py.

4. Initializing the Cleaned Frontend Dashboard
Open a distinct, secondary terminal window separate from your running Python task stream, and run this sequence to light up your React/Vite layout engine interface:

Bash
# Position your shell terminal into your UI subfolder location
cd frontend

# Install clean bundle dependencies according to the package rules
npm install

# Initialize the local Vite processing development compilation engine
npm run dev
Description: Accesses the node client stack directory, updates compilation packages, and maps your console system interface locally onto port 5173 without layout errors.

