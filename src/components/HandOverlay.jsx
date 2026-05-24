import { useEffect, useRef } from 'react'
import { HAND_CONNECTIONS, LANDMARK_TYPES } from '../utils/landmarks.js'

const COLORS = {
  wrist: '#00d4ff',
  fingertip: '#00ff88',
  knuckle: '#8b5cf6',
  connection: 'rgba(0, 212, 255, 0.4)',
  connectionActive: 'rgba(0, 255, 136, 0.5)',
}

export default function HandOverlay({ rawLandmarks, rawLandmarks2, handDetected, confidence = 0, videoRef }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const appearAnimRef = useRef({ progress: 0, appeared: false })

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef?.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')

    const sync = () => {
      if (video) {
        canvas.width = video.videoWidth || video.offsetWidth || 640
        canvas.height = video.videoHeight || video.offsetHeight || 480
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (!rawLandmarks || !handDetected) {
        appearAnimRef.current.appeared = false
        appearAnimRef.current.progress = 0
        animRef.current = requestAnimationFrame(sync)
        return
      }

      const w = canvas.width
      const h = canvas.height
      const isActive = confidence > 0.75

      // Animate appearance
      if (!appearAnimRef.current.appeared) {
        appearAnimRef.current.progress = Math.min(1, appearAnimRef.current.progress + 0.08)
        if (appearAnimRef.current.progress >= 1) appearAnimRef.current.appeared = true
      }
      const scale = appearAnimRef.current.progress

      ctx.save()
      ctx.globalAlpha = scale
      ctx.lineCap = 'round'

      const drawHand = (lms, isSecondary = false) => {
        if (!lms) return

        // Secondary hand gets a slightly different styling (more purple/amber depending on theme)
        const baseColor = isSecondary ? COLORS.knuckle : COLORS.connection
        const activeColor = isSecondary ? '#ffaa00' : COLORS.connectionActive

        ctx.lineWidth = 1.5
        ctx.strokeStyle = isActive ? activeColor : baseColor
        ctx.shadowBlur = isActive ? 6 : 3
        ctx.shadowColor = isActive ? (isSecondary ? '#ffaa00' : '#00ff88') : (isSecondary ? '#8b5cf6' : '#00d4ff')

        for (const [a, b] of HAND_CONNECTIONS) {
          const lmA = lms[a]
          const lmB = lms[b]
          if (!lmA || !lmB) continue
          ctx.beginPath()
          ctx.moveTo(lmA.x * w, lmA.y * h)
          ctx.lineTo(lmB.x * w, lmB.y * h)
          ctx.stroke()
        }

        ctx.shadowBlur = 0

        for (let i = 0; i < lms.length; i++) {
          const lm = lms[i]
          const x = lm.x * w
          const y = lm.y * h

          let color = isSecondary ? '#ffaa00' : COLORS.knuckle
          let radius = 3

          if (LANDMARK_TYPES.WRIST.includes(i)) {
            color = isSecondary ? '#ff3366' : COLORS.wrist
            radius = 5
          } else if (LANDMARK_TYPES.FINGERTIPS.includes(i)) {
            color = isSecondary ? '#8b5cf6' : COLORS.fingertip
            radius = 4
          }

          const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3)
          glow.addColorStop(0, color.replace(')', ', 0.5)').replace('rgb', 'rgba'))
          glow.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.beginPath()
          ctx.arc(x, y, radius * 3, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()

          ctx.beginPath()
          ctx.arc(x, y, radius * scale, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.shadowBlur = 8
          ctx.shadowColor = color
          ctx.fill()
          ctx.shadowBlur = 0
        }

      }

      drawHand(rawLandmarks)
      drawHand(rawLandmarks2, true)

      ctx.restore()

      animRef.current = requestAnimationFrame(sync)
    }

    animRef.current = requestAnimationFrame(sync)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [rawLandmarks, rawLandmarks2, handDetected, confidence, videoRef])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        zIndex: 10,
        // Mirror to match the video which is also scaleX(-1)
        transform: 'scaleX(-1)',
        // Keep landmark dots crisp when canvas is scaled by CSS
        imageRendering: 'crisp-edges',
        // GPU-accelerated layer prevents subpixel blur from 2D compositing
        willChange: 'transform',
      }}
    />
  )
}
