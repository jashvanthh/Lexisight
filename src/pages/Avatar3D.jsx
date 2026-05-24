// NEW CODE — Avatar3D.jsx
// 3D Hand Avatar Dashboard — Browse + Live AI modes
// Safe MediaPipe usage: does NOT manually call stop() since useMediaPipe
// already auto-stops on unmount via its own cleanup effect.

import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { useSharedClassifier } from '../contexts/ClassifierContext.jsx'
import { useMediaPipe } from '../hooks/useMediaPipe.js'
import HandOverlay from '../components/HandOverlay.jsx'

const AvatarScene = lazy(() => import('../components/avatar/AvatarScene.jsx'))

// ── Gesture categories ────────────────────────────────────────────────────────
const CATEGORIES = {
  words: {
    label: '💬 Common Signs', color: '#00d4ff',
    items: ['hello', 'yes', 'no', 'thankyou', 'please', 'sorry', 'good', 'bad',
      'help', 'come', 'go', 'eat', 'drink', 'water', 'pain', 'sleep', 'sit', 'stand', 'stop'],
  },
  letters: {
    label: '🔤 A–Z', color: '#8b5cf6',
    items: 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => `letter-${l}`),
  },
  digits: {
    label: '🔢 0–9', color: '#00ff88',
    items: Array.from({ length: 10 }, (_, i) => `digit-${i}`),
  },
}

function labelFor(key) {
  if (!key || key === 'idle') return 'Idle'
  if (key.startsWith('letter-')) return key.replace('letter-', '').toUpperCase()
  if (key.startsWith('digit-')) return key.replace('digit-', '')
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function SceneLoader() {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '2px solid transparent',
        borderTopColor: '#00d4ff', borderRightColor: '#8b5cf6',
        animation: 'spin-slow 1s linear infinite',
      }} />
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#6b8ba4', letterSpacing: '0.12em' }}>
        LOADING 3D SCENE...
      </span>
    </div>
  )
}

// ── Gesture Browser panel ─────────────────────────────────────────────────────
function GestureBrowser({ selected, onSelect, tab, onTabChange }) {
  const cat = CATEGORIES[tab]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      background: 'rgba(8,13,20,0.9)', border: '1px solid #1a2535',
      borderRadius: 14, padding: '0.9rem', flex: 1, overflowY: 'auto',
    }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#6b8ba4', letterSpacing: '0.12em' }}>
        GESTURE BROWSER
      </span>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} onClick={() => onTabChange(key)} style={{
            flex: 1, padding: '5px 4px', borderRadius: 8, fontSize: '0.6rem',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer',
            background: tab === key ? `${c.color}18` : 'transparent',
            border: `1px solid ${tab === key ? `${c.color}50` : '#1a2535'}`,
            color: tab === key ? c.color : '#6b8ba4',
          }}>{c.label}</button>
        ))}
      </div>
      {/* Chips */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: tab === 'letters' ? 'repeat(auto-fill,minmax(38px,1fr))' : 'repeat(auto-fill,minmax(72px,1fr))',
        gap: 5,
      }}>
        {cat.items.map(item => {
          const sel = selected === item
          return (
            <button key={item} onClick={() => onSelect(item)} style={{
              padding: tab === 'letters' ? '8px 2px' : '7px 5px', borderRadius: 8,
              fontSize: tab === 'letters' ? '0.85rem' : '0.7rem',
              fontFamily: tab === 'letters' ? 'JetBrains Mono, monospace' : 'DM Sans, sans-serif',
              fontWeight: 600, cursor: 'pointer', textAlign: 'center',
              background: sel ? `${cat.color}18` : 'rgba(26,37,53,0.5)',
              border: `1px solid ${sel ? `${cat.color}60` : '#1a2535'}`,
              color: sel ? cat.color : '#6b8ba4', transition: 'all 0.15s ease',
              boxShadow: sel ? `0 0 10px ${cat.color}28` : 'none',
            }}>{labelFor(item)}</button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Avatar3DPage() {
  const [mode, setMode] = useState('browse')   // 'browse' | 'live'
  const [gesture, setGesture] = useState('hello')
  const [speed, setSpeed] = useState(1)
  const [livePrediction, setLivePrediction] = useState(null)
  const [mirrorMode, setMirrorMode] = useState(false)
  const [browserTab, setBrowserTab] = useState('words')

  // Shared classifier for predictions (read-only)
  const classifier = useSharedClassifier()

  // MediaPipe — useMediaPipe already auto-stops on unmount, so do NOT call
  // mediapipe.stop() manually to avoid the double-delete WASM crash.
  const mediapipe = useMediaPipe()

  // Ref to track if we've initialised so we don't double-init in StrictMode
  const initDoneRef = useRef(false)

  // Start camera when entering Live mode
  useEffect(() => {
    if (mode === 'live' && !initDoneRef.current) {
      initDoneRef.current = true
      mediapipe.initialize()
    }
    if (mode === 'browse') {
      initDoneRef.current = false
      setLivePrediction(null)
    }
    // ⚠️ DO NOT return a cleanup that calls mediapipe.stop() —
    // useMediaPipe has its own cleanup effect that handles this correctly.
  }, [mode])

  useEffect(() => {
    if (mode !== 'live') {
      classifier.setMode('word')
      return
    }
    if (browserTab === 'letters') classifier.setMode('letter')
    else if (browserTab === 'digits') classifier.setMode('number')
    else classifier.setMode('word')
  }, [mode, browserTab, classifier])

  // Pipe live landmarks → classifier → avatar
  useEffect(() => {
    if (mode !== 'live' || !mediapipe.handDetected || !mediapipe.landmarks) return
    const result = classifier.predict?.(
      mediapipe.landmarks,
      mediapipe.rawLandmarks,
      mediapipe.rawLandmarks2,
      mediapipe.landmarks2,
      mediapipe.getHolisticFrame?.() ?? null,
    )
    if (result?.label) setLivePrediction(result)
  }, [
    mediapipe.landmarks,
    mediapipe.rawLandmarks,
    mediapipe.rawLandmarks2,
    mediapipe.landmarks2,
    mediapipe.handDetected,
    mode,
    classifier,
  ])

  // Active gesture: live prediction label OR manual browse selection
  const activeGesture = mode === 'live'
    ? (mirrorMode ? 'idle' : (livePrediction?.label ?? 'idle'))
    : gesture

  const isActive = activeGesture !== 'idle' || (mode === 'live' && mirrorMode && mediapipe.handDetected)

  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: '#020408', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(8,13,20,0.98)', borderBottom: '1px solid #1a2535',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <Link to="/" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#6b8ba4', textDecoration: 'none' }}>
          ← Back
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: '#00d4ff', letterSpacing: '0.15em' }}>3D HAND AVATAR</div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.15rem', color: '#e8f4fd', margin: 0 }}>
            ISL Gesture Visualizer
          </h1>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(26,37,53,0.6)', borderRadius: 10, padding: 4, border: '1px solid #1a2535' }}>
          {[['browse', '🔍 Browse'], ['live', '🔴 Live AI']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '5px 14px', borderRadius: 7, fontSize: '0.72rem',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 700, cursor: 'pointer',
              background: mode === m ? (m === 'live' ? 'rgba(0,255,136,0.12)' : 'rgba(0,212,255,0.12)') : 'transparent',
              border: `1px solid ${mode === m ? (m === 'live' ? 'rgba(0,255,136,0.4)' : 'rgba(0,212,255,0.4)') : 'transparent'}`,
              color: mode === m ? (m === 'live' ? '#00ff88' : '#00d4ff') : '#6b8ba4',
            }}>{label}</button>
          ))}
        </div>

        {/* Speed + reset controls */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {mode === 'live' && (
            <button onClick={() => setMirrorMode(m => !m)} style={{
              padding: '4px 12px', borderRadius: 8, fontSize: '0.68rem',
              fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
              background: mirrorMode ? 'rgba(0,255,136,0.12)' : 'rgba(26,37,53,0.8)',
              border: `1px solid ${mirrorMode ? 'rgba(0,255,136,0.4)' : '#1a2535'}`,
              color: mirrorMode ? '#00ff88' : '#6b8ba4',
            }}>{mirrorMode ? '🪞 Mirror: ON' : '🪞 Mirror: OFF'}</button>
          )}
          <button onClick={() => setSpeed(s => s === 1 ? 0.5 : 1)} style={{
            padding: '4px 12px', borderRadius: 8, fontSize: '0.68rem',
            fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
            background: speed < 1 ? 'rgba(255,170,0,0.12)' : 'rgba(26,37,53,0.8)',
            border: `1px solid ${speed < 1 ? 'rgba(255,170,0,0.4)' : '#1a2535'}`,
            color: speed < 1 ? '#ffaa00' : '#6b8ba4',
          }}>{speed < 1 ? '0.5×' : '1×'}</button>
          <button onClick={() => setGesture('idle')} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: '0.68rem',
            fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
            background: 'rgba(26,37,53,0.8)', border: '1px solid #1a2535', color: '#6b8ba4',
          }}>↺ Reset</button>
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div style={{
        background: '#020408', borderBottom: '1px solid #0d1520',
        padding: '4px 20px', display: 'flex', alignItems: 'center', gap: 14,
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.05em',
      }}>
        <span style={{ color: '#6b8ba4' }}>MODEL: <span style={{ color: '#00d4ff' }}>human-interpreter</span></span>
        <span style={{ color: '#1a2535' }}>│</span>
        <span style={{ color: '#6b8ba4' }}>MODE: <span style={{ color: mode === 'live' ? '#00ff88' : '#00d4ff' }}>{mode.toUpperCase()}</span></span>
        <span style={{ color: '#1a2535' }}>│</span>
        <span style={{ color: '#6b8ba4' }}>SIGN: <span style={{ color: isActive ? '#00ff88' : '#6b8ba4' }}>{mirrorMode && mode === 'live' ? 'LIVE MIRRORING' : labelFor(activeGesture).toUpperCase()}</span></span>
        {mode === 'live' && (
          <>
            <span style={{ color: '#1a2535' }}>│</span>
            <span style={{ color: mediapipe.handDetected ? '#00ff88' : '#6b8ba4' }}>
              {mediapipe.handDetected ? '✓ HAND' : '○ NO HAND'}
            </span>
            {livePrediction && (
              <>
                <span style={{ color: '#1a2535' }}>│</span>
                <span style={{ color: '#00ff88' }}>
                  {(livePrediction.confidence * 100).toFixed(0)}% conf
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'minmax(0,1fr) 320px',
        minHeight: 0,
      }}>

        {/* LEFT — 3D viewport */}
        <div style={{
          position: 'relative',
          background: 'radial-gradient(ellipse at center, #0a1525 0%, #020408 70%)',
          borderRight: '1px solid #1a2535', minHeight: 480,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Scanlines — pointerEvents:none so canvas stays interactive */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,212,255,0.012) 2px,rgba(0,212,255,0.012) 4px)',
          }} />

          {/* HUD corner brackets — pointerEvents:none */}
          {[
            { top: 88, left: 12, borderTop: '1.5px solid #00d4ff35', borderLeft: '1.5px solid #00d4ff35' },
            { top: 88, right: 12, borderTop: '1.5px solid #00d4ff35', borderRight: '1.5px solid #00d4ff35' },
            { bottom: 44, left: 12, borderBottom: '1.5px solid #00d4ff35', borderLeft: '1.5px solid #00d4ff35' },
            { bottom: 44, right: 12, borderBottom: '1.5px solid #00d4ff35', borderRight: '1.5px solid #00d4ff35' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 18, height: 18, zIndex: 3, pointerEvents: 'none', ...s }} />
          ))}

          {/* ── CURRENT SIGN label — sits in its own fixed-height block ABOVE the canvas */}
          {/* This is NOT absolutely positioned; it is in the flex column flow so    */}
          {/* the canvas always starts below it, preventing any overlap.             */}
          <div style={{
            flexShrink: 0,
            paddingTop: 16,
            paddingBottom: 12,
            textAlign: 'center',
            zIndex: 4,
            background: 'transparent',
            // min-height reserves space even when text transitions
            minHeight: 'clamp(72px, 10vw, 100px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.5rem', color: '#00d4ff',
              letterSpacing: '0.15em', marginBottom: 4,
            }}>
              CURRENT SIGN
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 900,
              fontSize: 'clamp(1.8rem, 5vw, 3rem)',
              color: isActive ? '#00ff88' : '#00d4ff',
              textShadow: `0 0 28px ${isActive ? 'rgba(0,255,136,0.45)' : 'rgba(0,212,255,0.35)'}`,
              transition: 'color 0.3s ease', lineHeight: 1,
            }}>
              {mirrorMode && mode === 'live' ? 'Live Mirror' : labelFor(activeGesture)}
            </div>
            {/* Thin separator line under the text to visually anchor it */}
            <div style={{
              marginTop: 10,
              width: 48, height: 1,
              background: 'linear-gradient(90deg, transparent, #00d4ff33, transparent)',
            }} />
          </div>

          {/* 3D Canvas — touch-action:none required for OrbitControls pointer capture */}
          {/* flex:1 ensures it fills ALL remaining height below the text block      */}
          <div style={{ flex: 1, minHeight: 360, position: 'relative', touchAction: 'none' }}>
            <Suspense fallback={<SceneLoader />}>
              <AvatarScene 
                gesture={activeGesture} 
                isActive={isActive} 
                speed={speed} 
                mirrorMode={mode === 'live' && mirrorMode}
                rawLandmarks={mediapipe.rawLandmarks}
                livePrediction={mode === 'live' && !mirrorMode ? livePrediction : null}
              />
            </Suspense>
          </div>

          {/* Hint */}
          <div style={{
            flexShrink: 0,
            textAlign: 'center',
            padding: '8px 0',
            zIndex: 4,
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.48rem',
            color: 'rgba(107,139,164,0.4)', letterSpacing: '0.08em', whiteSpace: 'nowrap',
          }}>
            DRAG TO ROTATE · SCROLL TO ZOOM
          </div>
        </div>

        {/* RIGHT panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#080d14', overflowY: 'auto' }}>
          <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Browse panel */}
            {mode === 'browse' && (
              <GestureBrowser
                selected={gesture}
                onSelect={setGesture}
                tab={browserTab}
                onTabChange={setBrowserTab}
              />
            )}

            {/* Live AI panel */}
            {mode === 'live' && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 12,
                background: 'rgba(8,13,20,0.9)', border: '1px solid #1a2535',
                borderRadius: 14, padding: '0.9rem', flex: 1,
              }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#6b8ba4', letterSpacing: '0.12em' }}>
                  LIVE AI MODE
                </span>

                <div style={{ display: 'flex', gap: 4 }}>
                  {Object.entries(CATEGORIES).map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBrowserTab(key)}
                      style={{
                        flex: 1,
                        padding: '5px 4px',
                        borderRadius: 8,
                        fontSize: '0.6rem',
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: browserTab === key ? `${c.color}18` : 'transparent',
                        border: `1px solid ${browserTab === key ? `${c.color}50` : '#1a2535'}`,
                        color: browserTab === key ? c.color : '#6b8ba4',
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Camera status */}
                <div style={{
                  padding: '12px', borderRadius: 10,
                  background: mediapipe.isReady ? 'rgba(0,255,136,0.06)' : 'rgba(0,212,255,0.06)',
                  border: `1px solid ${mediapipe.isReady ? 'rgba(0,255,136,0.2)' : 'rgba(0,212,255,0.15)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: mediapipe.isReady ? '#00ff88' : '#00d4ff',
                    boxShadow: `0 0 8px ${mediapipe.isReady ? '#00ff88' : '#00d4ff'}`,
                    animation: 'pulse-glow 1.5s ease-in-out infinite',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: mediapipe.isReady ? '#00ff88' : '#6b8ba4' }}>
                    {mediapipe.isReady ? 'Camera active — show your hand' : 'Starting camera...'}
                  </span>
                </div>

                {/* Live Mirror Mode Card Toggle */}
                <div style={{
                  padding: '12px', borderRadius: 10,
                  background: mirrorMode ? 'rgba(0,255,136,0.06)' : 'rgba(26,37,53,0.3)',
                  border: `1px solid ${mirrorMode ? 'rgba(0,255,136,0.2)' : '#1a2535'}`,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }}>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: mirrorMode ? '#00ff88' : '#e8f4fd' }}>
                      🪞 3D Skeletal Mirror Mode
                    </span>
                    <button onClick={() => setMirrorMode(m => !m)} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: '0.58rem',
                      fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, cursor: 'pointer',
                      background: mirrorMode ? '#00ff88' : '#1a2535',
                      border: 'none',
                      color: mirrorMode ? '#020408' : '#6b8ba4',
                    }}>{mirrorMode ? 'ACTIVE' : 'OFF'}</button>
                  </div>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.68rem', color: '#6b8ba4', lineHeight: 1.4 }}>
                    Maps webcam hand landmarks directly to the 3D skeleton in real time instead of displaying word signs.
                  </span>
                </div>

                {/* Live prediction display */}
                {livePrediction && !mirrorMode && (
                  <div style={{
                    padding: '14px', borderRadius: 10,
                    background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.2)',
                  }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: '#6b8ba4', letterSpacing: '0.1em', marginBottom: 6 }}>
                      DETECTED SIGN
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '2rem', color: '#00ff88' }}>
                      {labelFor(livePrediction.label)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#0d1520', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(livePrediction.confidence * 100).toFixed(0)}%`,
                          height: '100%', background: '#00ff88',
                          transition: 'width 0.3s ease', borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#00ff88' }}>
                        {(livePrediction.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Camera preview — below detection results */}
                <div style={{
                  borderRadius: 10, overflow: 'hidden',
                  border: `1px solid ${mediapipe.handDetected ? 'rgba(0,255,136,0.4)' : 'rgba(0,212,255,0.2)'}`,
                  background: '#020408', position: 'relative',
                  boxShadow: mediapipe.handDetected ? '0 0 14px rgba(0,255,136,0.15)' : 'none',
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}>
                  {/* LIVE dot */}
                  <div style={{
                    position: 'absolute', top: 7, left: 8, zIndex: 2,
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(2,4,8,0.7)', borderRadius: 4, padding: '2px 7px',
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff3b3b', boxShadow: '0 0 5px #ff3b3b', animation: 'pulse-glow 1s ease-in-out infinite' }} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.45rem', color: '#e8f4fd', letterSpacing: '0.08em' }}>CAMERA</span>
                  </div>
                  {/* ✓ HAND badge */}
                  {mediapipe.handDetected && (
                    <div style={{
                      position: 'absolute', top: 7, right: 8, zIndex: 2,
                      background: 'rgba(0,255,136,0.18)', borderRadius: 4, padding: '2px 6px',
                    }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.42rem', color: '#00ff88' }}>✓ HAND</span>
                    </div>
                  )}
                  <video
                    ref={mediapipe.videoRef}
                    style={{ width: '100%', display: 'block', transform: 'scaleX(-1)', borderRadius: 10 }}
                    playsInline muted autoPlay
                  />
                  {/* Hand skeleton overlay — same landmark lines as Translator */}
                  <HandOverlay
                    rawLandmarks={mediapipe.rawLandmarks}
                    rawLandmarks2={mediapipe.rawLandmarks2}
                    handDetected={mediapipe.handDetected}
                    confidence={livePrediction?.confidence ?? 0}
                    videoRef={mediapipe.videoRef}
                  />
                </div>

                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.74rem', color: '#6b8ba4', lineHeight: 1.6, marginTop: 'auto' }}>
                  The AI model detects your gesture via webcam. The 3D hand mirrors the prediction in real time.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '1rem', borderTop: '1px solid #1a2535' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: '#00d4ff', letterSpacing: '0.1em', marginBottom: 6 }}>
              ABOUT THIS VIEWER
            </div>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.73rem', color: '#6b8ba4', lineHeight: 1.6, margin: '0 0 10px' }}>
              3D hand visualizes ISL gestures. In Live AI mode, predictions come exclusively from the ML model.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/translate" style={{
                padding: '5px 12px', borderRadius: 8, fontSize: '0.72rem',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 600, textDecoration: 'none',
                background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff',
              }}>↗ Translator</Link>
              <Link to="/learn" style={{
                padding: '5px 12px', borderRadius: 8, fontSize: '0.72rem',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 600, textDecoration: 'none',
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', color: '#8b5cf6',
              }}>📚 Learn ISL</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
