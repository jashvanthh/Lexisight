import ConfidenceTopK from './ConfidenceTopK.jsx'

/**
 * Real-time sign readout: primary prediction + Top-3 alternatives + buffer progress.
 */
export default function LiveSignPanel({
  live,
  confirmed,
  bufferProgress = 0,
  handDetected = false,
  mode = 'word',
  lockInEnabled = true,
  t = (k) => k,
}) {
  const display = confirmed || live
  const topK = confirmed?.topK || live?.topK || []
  const conf = display?.confidence ?? 0
  const pct = Math.round(conf * 100)
  const isPreview = live?.isPreview && !confirmed
  const fill = Math.round((bufferProgress || 0) * 100)
  const showLiveGhost = lockInEnabled && live && confirmed && live.label !== confirmed.label

  let statusText = 'Show your hands to the camera'
  let statusColor = '#6b8ba4'
  if (handDetected) {
    if (mode !== 'word') {
      statusText = lockInEnabled ? 'Locked in ✓' : 'Live recognition'
      statusColor = lockInEnabled ? '#00ff88' : '#00d4ff'
    } else if (bufferProgress < 1) {
      statusText = `Recording sign… ${fill}%`
      statusColor = '#ffaa00'
    } else if (isPreview) {
      statusText = 'Analyzing motion…'
      statusColor = '#00d4ff'
    } else if (display?.label) {
      statusText = confirmed ? 'Sign locked ✓' : 'Live match'
      statusColor = '#00ff88'
    } else {
      statusText = 'Hold the sign steady'
      statusColor = '#ffaa00'
    }
  }

  return (
    <div
      className="glass-card-cyan p-4"
      style={{
        border: display
          ? '1px solid rgba(0, 255, 136, 0.35)'
          : '1px solid var(--border)',
        boxShadow: display ? '0 0 24px rgba(0,255,136,0.08)' : 'none',
      }}
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Primary prediction */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="hud-label">{t('detected_gesture') || 'Live sign'}</span>
            <span
              className="font-mono text-xs px-2 py-0.5 rounded-full"
              style={{
                color: statusColor,
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}44`,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {statusText}
            </span>
          </div>

          {mode === 'word' && handDetected && bufferProgress < 1 && (
            <div className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="hud-label" style={{ fontSize: '0.65rem' }}>Sequence buffer</span>
                <span style={{ color: '#ffaa00', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  {fill}%
                </span>
              </div>
              <div className="confidence-bar-track" style={{ height: 4 }}>
                <div
                  className="confidence-bar-fill"
                  style={{
                    width: `${fill}%`,
                    background: 'linear-gradient(90deg, #ffaa00, #00d4ff)',
                    transition: 'width 0.15s ease-out',
                  }}
                />
              </div>
            </div>
          )}

          <div
            className="font-dm font-black leading-none break-words"
            style={{
              fontSize: 'clamp(2.2rem, 4.5vw, 4.2rem)',
              color: display ? (isPreview ? '#00d4ff' : '#00ff88') : '#2a3545',
              textShadow: display
                ? isPreview
                  ? '0 0 24px rgba(0,212,255,0.35)'
                  : '0 0 30px rgba(0,255,136,0.4)'
                : 'none',
              minHeight: 56,
              transition: 'color 0.15s, text-shadow 0.15s',
            }}
          >
            {display?.label || '—'}
          </div>

          {display && (
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.8rem',
                  color: isPreview ? '#00d4ff' : '#00ff88',
                }}
              >
                {pct}% confidence
              </span>
              {showLiveGhost && (
                <span className="text-xs" style={{ color: '#00d4ff' }}>
                  Live: <strong>{live.label}</strong> ({Math.round((live.confidence || 0) * 100)}%)
                </span>
              )}
              {live?.margin != null && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  margin {(live.margin * 100).toFixed(0)}%
                </span>
              )}
            </div>
          )}

          {!display && handDetected && mode === 'word' && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Keep signing — the model needs ~1 second of motion before a word match appears.
            </p>
          )}
        </div>

        {/* Top-3 box */}
        <div
          className="shrink-0 w-full lg:w-56 rounded-lg p-3"
          style={{
            background: 'rgba(8, 13, 20, 0.6)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
          }}
        >
          <div className="hud-label mb-2" style={{ color: '#00d4ff' }}>
            Top 3 words
          </div>
          {topK.length > 0 ? (
            <ConfidenceTopK topK={topK} />
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {handDetected
                ? bufferProgress < 1
                  ? 'Alternatives appear as the sign sequence fills.'
                  : 'No confident alternatives yet — adjust lighting or hold the sign.'
                : '—'}
            </p>
          )}
          {display && topK.length >= 2 && topK[0].label !== topK[1].label && (
            <p className="text-xs mt-2 pt-2" style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}>
              {topK[1].confidence > 0.25
                ? 'Similar signs detected — check Top 3 if the main word looks wrong.'
                : 'Strong single match.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
