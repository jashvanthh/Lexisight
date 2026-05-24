import { useState, useEffect, useRef, useCallback } from 'react'
import { FilesetResolver, HolisticLandmarker } from '@mediapipe/tasks-vision'
import { useSettings } from './useSettings.jsx'
import { normalizeLandmarks } from '../utils/landmarks.js'
import { holisticResultToVector } from '../utils/holisticFeatures.js'
import { LandmarkKalmanFilter } from '../utils/kalmanFilter.js'
import { telemetry } from '../utils/observability.js'

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js'

export function useMediaPipe() {
  const { settings } = useSettings()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const handsRef = useRef(null)
  const holisticRef = useRef(null)
  const animFrameRef = useRef(null)
  const kalmanRef = useRef(new LandmarkKalmanFilter())
  const kalman2Ref = useRef(new LandmarkKalmanFilter())
  const streamRef = useRef(null)

  const [landmarks, setLandmarks] = useState(null)
  const [rawLandmarks, setRawLandmarks] = useState(null)
  const [landmarks2, setLandmarks2] = useState(null)
  const [rawLandmarks2, setRawLandmarks2] = useState(null)
  /** Updated every frame; read via getHolisticFrame() — not React state (avoids re-render storms). */
  const holisticFrameRef = useRef(null)
  const [handDetected, setHandDetected] = useState(false)
  const [hand2Detected, setHand2Detected] = useState(false)
  const [fps, setFps] = useState(0)
  const [error, setError] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [cameraPermission, setCameraPermission] = useState('prompt')
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)

  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() })
  const frameSkipRef = useRef(0)

  const loadScript = useCallback((src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
      const s = document.createElement('script')
      s.src = src
      s.crossOrigin = 'anonymous'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }, [])

  /** Enumerate cameras and pick the best one for laptop/desktop use */
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)

      // Prefer a camera that matches the user's facing preference (user/environment)
      const targetFacing = settings.cameraFacing || 'user'
      const preferredCam = videoDevices.find(d => {
        const label = d.label.toLowerCase()
        const isBack = label.includes('back') || label.includes('rear') || label.includes('environment')
        return targetFacing === 'environment' ? isBack : !isBack
      }) || videoDevices[0]

      if (preferredCam && !selectedCameraId) {
        setSelectedCameraId(preferredCam.deviceId)
        return preferredCam.deviceId
      }
      return selectedCameraId || (videoDevices[0]?.deviceId)
    } catch (e) {
      return null
    }
  }, [selectedCameraId])

  const initialize = useCallback(async (cameraId = null) => {
    // Teardown previous stream if re-initializing
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    setError(null)
    setIsReady(false)

    try {
      // Load MediaPipe Hands from CDN
      await loadScript(MEDIAPIPE_CDN)
      if (!window.Hands) throw new Error('MediaPipe Hands failed to load')

      const hands = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      })

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      })

      hands.onResults((results) => {
        const multi = results.multiHandLandmarks || []

        // ── Primary hand (with Kalman filter for missing frames) ─────────
        if (multi.length > 0) {
          const lms = multi[0]
          if (telemetry.toggles.kalmanFilter) kalmanRef.current.update(lms)
          setRawLandmarks(lms)
          setLandmarks(normalizeLandmarks(lms))
          setHandDetected(true)
        } else {
          // Kalman prediction instead of zero-filling
          const predicted = telemetry.toggles.kalmanFilter ? kalmanRef.current.predict() : null
          if (predicted) {
            telemetry.log('KALMAN', 'Predicted missing primary hand landmarks')
            setRawLandmarks(predicted)
            setLandmarks(normalizeLandmarks(predicted))
            setHandDetected(true) // Keep detected=true during prediction
          } else {
            setHandDetected(false)
            setLandmarks(null)
            setRawLandmarks(null)
          }
        }

        // ── Secondary hand (with Kalman filter) ──────────────────────────
        if (multi.length > 1) {
          const lms2 = multi[1]
          if (telemetry.toggles.kalmanFilter) kalman2Ref.current.update(lms2)
          setRawLandmarks2(lms2)
          setLandmarks2(normalizeLandmarks(lms2))
          setHand2Detected(true)
        } else {
          const predicted2 = telemetry.toggles.kalmanFilter ? kalman2Ref.current.predict() : null
          if (predicted2) {
            telemetry.log('KALMAN', 'Predicted missing secondary hand landmarks')
            setRawLandmarks2(predicted2)
            setLandmarks2(normalizeLandmarks(predicted2))
            setHand2Detected(true)
          } else {
            setHand2Detected(false)
            setLandmarks2(null)
            setRawLandmarks2(null)
          }
        }

        const counter = fpsCounterRef.current
        counter.frames++
        const now = Date.now()
        if (now - counter.lastTime >= 1000) {
          setFps(counter.frames)
          counter.frames = 0
          counter.lastTime = now
        }
      })

      handsRef.current = hands

      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
        )
        holisticRef.current = await HolisticLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/mediapipe/holistic_landmarker.task' },
          runningMode: 'VIDEO',
          minPoseDetectionConfidence: 0.4,
          minPoseLandmarksConfidence: 0.4,
          minHandLandmarksConfidence: 0.4,
        })
      } catch (holisticErr) {
        console.warn('[LexiSight] Holistic landmarker failed to load:', holisticErr)
        holisticRef.current = null
      }

      // Build video constraints — prefer specific device or front-facing
      // Use ONLY deviceId if we have it (avoids strict facingMode on laptops)
      const resolvedId = cameraId || await enumerateCameras()

      // Request HD (1280×720) — falls back to 640×480 minimum if camera can't do HD.
      // This eliminates blurry upscaling and the 4:3 zoom caused by aspect-ratio mismatch.
      const hdConstraints = {
        width:  { ideal: 1280, min: 640 },
        height: { ideal: 720,  min: 480 },
        frameRate: { ideal: 30, min: 15 },
      }
      const videoConstraints = resolvedId
        ? { deviceId: { exact: resolvedId }, ...hdConstraints }
        : { ...hdConstraints, facingMode: { ideal: 'user' } }

      setCameraPermission('prompt')
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
      streamRef.current = stream
      setCameraPermission('granted')

      // Enumerate cameras now (labels available after permission granted)
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)

      // Track actual camera used
      const activeTrack = stream.getVideoTracks()[0]
      const settings = activeTrack?.getSettings?.() || {}
      if (settings.deviceId) setSelectedCameraId(settings.deviceId)

      // KEY FIX: set isReady=true FIRST so React renders <video ref={videoRef}>
      // Then wait two rAF frames for React to commit the DOM before assigning srcObject
      setIsReady(true)
      await new Promise(resolve => requestAnimationFrame(resolve))
      await new Promise(resolve => requestAnimationFrame(resolve))

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (e) {
          console.warn('LexiSight: video.play() blocked —', e.message)
        }
      } else {
        console.error('LexiSight: videoRef is null — the <video> element was not rendered in time')
      }

      startLoop()
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'NotFoundError') {
        setCameraPermission('denied')
        setError('camera_denied')
      } else {
        setError(err.message || 'Camera initialization failed')
      }
    }
  }, [loadScript, enumerateCameras])

  const startLoop = useCallback(() => {
    const loop = async () => {
      if (!videoRef.current || !handsRef.current) return
      if (videoRef.current.readyState >= 2) {
        frameSkipRef.current++
        if (frameSkipRef.current % 2 === 0) {
          await handsRef.current.send({ image: videoRef.current })
        }
        // Holistic is heavy — run every 4th processed frame (~7–8 Hz), store in ref only
        if (holisticRef.current && frameSkipRef.current % 8 === 0) {
          try {
            const res = holisticRef.current.detectForVideo(videoRef.current, performance.now())
            holisticFrameRef.current = holisticResultToVector(res)
          } catch {
            /* skip bad frame */
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
  }, [])

  /** Switch to a different camera without re-initializing MediaPipe */
  const switchCamera = useCallback(async (deviceId) => {
    setSelectedCameraId(deviceId)
    await initialize(deviceId)
  }, [initialize])

  const stop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (handsRef.current) handsRef.current.close()
    if (holisticRef.current) {
      holisticRef.current.close()
      holisticRef.current = null
    }
    holisticFrameRef.current = null
    setIsReady(false)
    setHandDetected(false)
    setHand2Detected(false)
    setLandmarks(null)
    setRawLandmarks(null)
    setLandmarks2(null)
    setRawLandmarks2(null)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  const getHolisticFrame = useCallback(() => holisticFrameRef.current, [])

  return {
    videoRef,
    canvasRef,
    landmarks,
    rawLandmarks,
    landmarks2,
    rawLandmarks2,
    getHolisticFrame,
    handDetected,
    hand2Detected,
    fps,
    error,
    isReady,
    cameraPermission,
    availableCameras,
    selectedCameraId,
    initialize,
    switchCamera,
    stop,
  }
}
