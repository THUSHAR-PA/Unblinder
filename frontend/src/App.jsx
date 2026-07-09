import React, { useEffect, useState, useRef } from 'react'

export default function App() {
  const [objects, setObjects] = useState([])
  const [aiDescription, setAiDescription] = useState("Initializing environment orientation...")
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [running, setRunning] = useState(true)
  
  const [lastUpdate, setLastUpdate] = useState(null)
  const [fps, setFps] = useState(0)
  
  const wsRef = useRef(null)
  const msgCountRef = useRef(0)
  const imgRef = useRef(null)

  const spokenObjectsCooldownRef = useRef({})

  const voiceEnabledRef = useRef(voiceEnabled)
  const runningRef = useRef(running)
  const aiDescRef = useRef(aiDescription)

  useEffect(() => { voiceEnabledRef.current = voiceEnabled }, [voiceEnabled])
  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { aiDescRef.current = aiDescription }, [aiDescription])

  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  useEffect(() => {
    const wsProto = BACKEND.startsWith('https') ? 'wss' : 'ws'
    const wsHost = BACKEND.replace(/^https?:/, '')
    const wsUrl = `${wsProto}:${wsHost}/ws`

    function connect() {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      
      ws.onmessage = (ev) => {
        msgCountRef.current += 1
        try {
          const data = JSON.parse(ev.data)
          
          if (!voiceEnabledRef.current) {
            window.speechSynthesis.cancel()
          }

          if (runningRef.current) {
            const liveObjects = data.objects || []
            
            setObjects(liveObjects)
            
            if (data.description && data.description !== aiDescRef.current) {
              setAiDescription(data.description)
            }

            if (voiceEnabledRef.current) {
              const now = Date.now()
              liveObjects.forEach((obj) => {
                const lastSpoken = spokenObjectsCooldownRef.current[obj.name] || 0
                
                if (!lastSpoken || (now - lastSpoken > 5000)) {
                  spokenObjectsCooldownRef.current[obj.name] = now
                  
                  const phrase = `${obj.name}, ${obj.steps_away} steps away on your ${obj.position}.`
                  const utterance = new SpeechSynthesisUtterance(phrase)
                  utterance.rate = 1.15
                  window.speechSynthesis.speak(utterance)
                }
              })
            }
          } else {
            // When paused, force clear the bounding box list on the frontend visually
            setObjects([])
          }
          setLastUpdate(new Date().toLocaleTimeString())
        } catch (e) {
          console.error(e)
        }
      }
      ws.onerror = (e) => console.error('WS error', e)
      ws.onclose = () => {
        setTimeout(connect, 1000)
      }
    }

    connect()

    const fpsI = setInterval(() => {
      setFps(msgCountRef.current)
      msgCountRef.current = 0
    }, 1000)

    return () => {
      clearInterval(fpsI)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  useEffect(() => {
    if (running && voiceEnabled && aiDescription) {
      window.speechSynthesis.cancel() 
      const utterance = new SpeechSynthesisUtterance(aiDescription)
      utterance.rate = 1.1
      window.speechSynthesis.speak(utterance)
    }
  }, [aiDescription, voiceEnabled, running])

  function snapshot() {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `snapshot-${Date.now()}.png`
      a.click()
    }
  }

  function toggleRunning() {
    const nextState = !running
    setRunning(nextState)
    if (!nextState) window.speechSynthesis.cancel()
  }

  async function stopCamera() {
    try {
      await fetch(`${BACKEND}/camera/stop`, { method: 'POST' })
      setRunning(false)
      window.speechSynthesis.cancel()
    } catch (err) {
      console.error(err)
    }
  }

  async function startCamera() {
    try {
      await fetch(`${BACKEND}/camera/start`, { method: 'POST' })
      setRunning(true)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="unblinder-app" style={{ minHeight: '100vh', background: '#030712', color: '#f3f4f6', fontFamily: '"SF Pro Display", -apple-system, sans-serif', padding: '2rem' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #1f2937' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.05em', background: 'linear-gradient(to right, #ffffff, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>UNBLINDER COGNITIVE CONSOLE</h1>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem', marginTop: '4px' }}>Tactical Core Architecture • Accelerated Spatial Telemetry Frame</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#111827', padding: '0.75rem 1.5rem', borderRadius: '14px', border: '1px solid #374151' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '10px', borderRight: '1px solid #374151', paddingRight: '20px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: voiceEnabled ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
              🔊 SPEECH: {voiceEnabled ? "ACTIVE" : "MUTED"}
            </span>
            <button 
              onClick={() => {
                const nextState = !voiceEnabled
                setVoiceEnabled(nextState)
                if (!nextState) {
                  window.speechSynthesis.cancel()
                }
              }}
              style={{
                width: '50px',
                height: '26px',
                borderRadius: '13px',
                background: voiceEnabled ? '#10b981' : '#374151',
                position: 'relative',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.3s'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#ffffff',
                position: 'absolute',
                top: '3px',
                left: voiceEnabled ? '27px' : '3px',
                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </button>
          </div>

          <button onClick={toggleRunning} style={{ background: '#374151', border: 'none', color: '#fff', fontWeight: '600', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}>{running ? 'Pause UI' : 'Resume UI'}</button>
          <button onClick={snapshot} style={{ background: '#374151', border: 'none', color: '#fff', fontWeight: '600', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}>Snapshot</button>
          <button onClick={running ? stopCamera : startCamera} style={{ background: running ? '#991b1b' : '#065f46', border: 'none', color: '#fff', fontWeight: '600', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}>{running ? 'Stop Camera' : 'Start Camera'}</button>
          <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#6b7280' }}>LATENCY: {fps > 0 ? `${Math.round(1000/fps)}ms` : '—'} • FPS: {fps}</div>
        </div>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '2rem', alignItems: 'start' }}>
        
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* DYNAMIC CAMERA RENDER BLOCK */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000000', borderRadius: '18px', overflow: 'hidden', border: '2px solid #1f2937', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
            
            {running ? (
              <>
                <img 
                  ref={imgRef} 
                  src={`${BACKEND}/video_feed`} 
                  alt="Optical Video Feed" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <div style={{ position: 'absolute', top: '20px', left: '20px', width: '15px', height: '15px', borderTop: '3px solid #10b981', borderLeft: '3px solid #10b981' }} />
                <div style={{ position: 'absolute', top: '20px', right: '20px', width: '15px', height: '15px', borderTop: '3px solid #10b981', borderRight: '3px solid #10b981' }} />
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '15px', height: '15px', borderBottom: '3px solid #10b981', borderLeft: '3px solid #10b981' }} />
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '15px', height: '15px', borderBottom: '3px solid #10b981', borderRight: '3px solid #10b981' }} />
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#030712' }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                  <path d="M13 13v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.5l.5-1"></path>
                  <line x1="2" y1="2" x2="22" y2="22"></line>
                  <path d="M10 5h4l2 3h4a2 2 0 0 1 2 2v7.5"></path>
                </svg>
                <h3 style={{ color: '#9ca3af', fontSize: '1.2rem', fontWeight: '600', marginBottom: '1.5rem', fontFamily: 'monospace' }}>SENSOR LINK OFFLINE</h3>
                <button
                  onClick={startCamera}
                  style={{ background: '#10b981', color: '#022c22', fontWeight: '800', padding: '0.8rem 2rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3v18l15-9L5 3z"/></svg>
                  ENGAGE CAMERA SENSOR
                </button>
              </div>
            )}

          </div>
          
          <div style={{ padding: '2rem', background: 'linear-gradient(135deg, #0b0f19, #111827)', borderRadius: '18px', border: '1px solid #1f2937', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }} />
              Periodic Environmental Scene Core Overview (10s Recalibration Interval)
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f9fafb', lineHeight: '1.4', letterSpacing: '-0.02em' }}>
              "{aiDescription}"
            </div>
          </div>
        </section>

        <aside style={{ background: '#0b0f19', padding: '1.7rem', borderRadius: '18px', border: '1px solid #1f2937', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ borderBottom: '1px solid #1f2937', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Realtime Tracked Targets</h2>
            <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '2px', fontFamily: 'monospace' }}>TELEMETRY LAYER STATUS: {running ? 'SYNCHRONIZED' : 'OFFLINE'}</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '350px' }}>
            {objects.length === 0 && (
              <div style={{ color: '#4b5563', textAlign: 'center', padding: '4rem 0', fontFamily: 'monospace', fontSize: '0.9rem', border: '1px dashed #1f2937', borderRadius: '12px' }}>
                [ VACANT VIEWPORT FIELD ]<br/>No immediate objects registered.
              </div>
            )}
            
            {objects.map((o, i) => (
              <div 
                key={`${o.name}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  background: '#111827',
                  padding: '1.2rem',
                  borderRadius: '14px',
                  border: '1px solid #374151',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <div style={{ 
                  background: o.position === 'center' ? '#0284c7' : o.position === 'left' ? '#b45309' : '#6d28d9', 
                  color: '#ffffff', 
                  fontWeight: '800', 
                  padding: '10px', 
                  borderRadius: '10px', 
                  fontSize: '0.9rem', 
                  width: '42px', 
                  textAlign: 'center',
                  fontFamily: 'monospace'
                }}>
                  {(o.position || 'ce').slice(0, 2).toUpperCase()}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff', textTransform: 'capitalize' }}>
                      {o.name}
                    </div>
                    <span style={{ fontSize: '0.75rem', background: '#030712', padding: '3px 10px', borderRadius: '6px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', fontFamily: 'monospace', border: '1px solid #1f2937' }}>
                      {o.position} axis
                    </span>
                  </div>
                  
                  <div style={{ marginTop: '6px', fontSize: '0.95rem', color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚡ RANGE:</span>
                    <span style={{ color: '#f59e0b', fontWeight: '800', background: '#78350f', padding: '1px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                      {o.steps_away} STEPS AWAY
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <div style={{ flex: 1, height: '5px', background: '#1f2937', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#10b981', width: `${Math.min(100, (o.confidence || 0) * 100)}%` }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace', width: '35px', textAlign: 'right' }}>
                      {Math.round((o.confidence || 0) * 100)}%
                    </div>
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