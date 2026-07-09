import React, { useEffect, useState, useRef } from 'react'

export default function App() {
  const [objects, setObjects] = useState([])

  
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const [running, setRunning] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [fps, setFps] = useState(0)
  const wsRef = useRef(null)
  const msgCountRef = useRef(0)
  const imgRef = useRef(null)

  useEffect(() => {
    const wsProto = BACKEND.startsWith('https') ? 'wss' : 'ws'
    const wsHost = BACKEND.replace(/^https?:/, '') // keep host:port
    const wsUrl = `${wsProto}:${wsHost}/ws`

    function connect() {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.onmessage = (ev) => {
        msgCountRef.current += 1
        try {
          const data = JSON.parse(ev.data)
          if (running) setObjects(data.objects || [])
          setLastUpdate(new Date().toLocaleTimeString())
        } catch (e) {
          console.error(e)
        }
      }
      ws.onerror = (e) => console.error('WS error', e)
      ws.onclose = () => {
        // try to reconnect after short delay
        setTimeout(connect, 1000)
      }
    }

    connect()

    const fpsI = setInterval(() => {
      const c = msgCountRef.current
      setFps(c)
      msgCountRef.current = 0
    }, 1000)

    return () => {
      clearInterval(fpsI)
      if (wsRef.current) wsRef.current.close()
    }
  }, [running])

  function snapshot() {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `snapshot-${Date.now()}.png`
    a.click()
  }

  function toggleRunning() {
    setRunning(r => !r)
  }

  async function stopCamera() {
    try {
      await fetch(`${BACKEND}/camera/stop`, { method: 'POST' })
      setRunning(false)
    } catch (err) {
      console.error('Stop camera failed', err)
    }
  }

  async function startCamera() {
    try {
      await fetch(`${BACKEND}/camera/start`, { method: 'POST' })
      setRunning(true)
    } catch (err) {
      console.error('Start camera failed', err)
    }
  }

  return (
    <div className="container">
      <header>
        <div>
          <h1>Unblinder Dashboard</h1>
          <p>Live camera view · detections powered by YOLO</p>
        </div>
        <div className="controls">
          <button onClick={toggleRunning}>{running ? 'Pause' : 'Resume'}</button>
          <button onClick={snapshot}>Snapshot</button>
          <button onClick={running ? stopCamera : startCamera}>{running ? 'Stop Camera' : 'Start Camera'}</button>
          <div className="status">Last: {lastUpdate || '—'} • WS FPS: {fps}</div>
        </div>
      </header>
      <main>
        <section className="video">
          <div className="video-wrap">
            <img ref={imgRef} src={`${BACKEND}/video_feed`} alt="Live" />
            <div className="overlay">
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="live-dot" />
                <div className="det-count">{objects.length} detections</div>
              </div>
            </div>
          </div>
        </section>
        <aside className="sidebar">
          <h2>Detections</h2>
          <div className="subtitle">Realtime list with confidence bars</div>
          <div className="det-list">
            {objects.length === 0 && <div className="empty">No objects</div>}
            {objects.map((o, i) => (
              <div className="det-item" key={i}>
                <div className="avatar">{(o.name||'?').slice(0,2).toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div className="det-name">{o.name}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                    <div className="det-bar"><div className="det-fill" style={{ width: `${Math.min(100, (o.confidence||0)*100)}%` }} /></div>
                    <div className="det-conf">{Math.round((o.confidence||0)*100)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  )
}
