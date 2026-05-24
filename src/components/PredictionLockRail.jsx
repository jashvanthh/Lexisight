/**
 * Right-rail slide control: Lock in vs Live (no lock) + feedback ✓/✗
 */
import { useState } from 'react'

export default function PredictionLockRail({
  lockInEnabled,
  onLockInChange,
  displayLabel,
  displayConfidence,
  mode,
  topK = [],
  onFeedback,
  convexSynced = false,
  compact = false,
}) {
  const [showCorrectPicker, setShowCorrectPicker] = useState(false)
  const [customLabel, setCustomLabel] = useState('')

  const submitWrong = (correctLabel) => {
    if (!displayLabel || !correctLabel) return
    onFeedback?.(false, correctLabel)
    setShowCorrectPicker(false)
    setCustomLabel('')
  }

  return (
    <div
      className="flex flex-col items-center gap-3 shrink-0"
      style={{
        width: compact ? '100%' : 52,
        padding: compact ? '12px 0' : '8px 4px',
      }}
    >
      {/* Vertical slide: Lock in */}
      <div
        className="flex flex-col items-center gap-2"
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
        }}
      >
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.58rem',
            letterSpacing: '0.12em',
            color: lockInEnabled ? '#00ff88' : 'var(--text-secondary)',
          }}
        >
          LOCK IN
        </span>
        <label className="toggle" style={{ transform: 'rotate(90deg)' }} title={lockInEnabled ? 'Locked display' : 'Live display'}>
          <input
            type="checkbox"
            checked={lockInEnabled}
            onChange={(e) => onLockInChange(e.target.checked)}
            aria-label="Lock in prediction"
          />
          <span className="toggle-slider" />
        </label>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.58rem',
            letterSpacing: '0.12em',
            color: !lockInEnabled ? '#00d4ff' : 'var(--text-secondary)',
          }}
        >
          LIVE
        </span>
      </div>

      {!compact && (
        <div
          style={{
            width: 2,
            flex: 1,
            minHeight: 24,
            background: 'linear-gradient(to bottom, transparent, rgba(0,212,255,0.35), transparent)',
            borderRadius: 2,
          }}
        />
      )}

      {/* Feedback */}
      <div className="flex flex-col items-center gap-2" style={{ transform: compact ? 'none' : 'rotate(0deg)' }}>
        <span className="hud-label" style={{ fontSize: '0.55rem', textAlign: 'center' }}>
          Correct?
        </span>
        {convexSynced && (
          <span
            title="Feedback synced to Convex"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#00ff88',
              boxShadow: '0 0 6px #00ff88',
            }}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={!displayLabel}
            onClick={() => onFeedback?.(true)}
            title="Yes, correct"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid #00ff88',
              background: 'rgba(0,255,136,0.12)',
              color: '#00ff88',
              fontSize: '1rem',
              cursor: displayLabel ? 'pointer' : 'not-allowed',
              opacity: displayLabel ? 1 : 0.35,
            }}
          >
            ✓
          </button>
          <button
            type="button"
            disabled={!displayLabel}
            onClick={() => setShowCorrectPicker((v) => !v)}
            title="No, wrong"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid #ff3366',
              background: 'rgba(255,51,102,0.12)',
              color: '#ff3366',
              fontSize: '1rem',
              cursor: displayLabel ? 'pointer' : 'not-allowed',
              opacity: displayLabel ? 1 : 0.35,
            }}
          >
            ✗
          </button>
        </div>
      </div>

      {showCorrectPicker && displayLabel && (
        <div
          className="glass-card-cyan p-2"
          style={{
            position: compact ? 'relative' : 'absolute',
            right: compact ? 'auto' : 56,
            top: compact ? 'auto' : '40%',
            zIndex: 20,
            width: compact ? '100%' : 160,
            marginTop: compact ? 8 : 0,
          }}
        >
          <div className="hud-label mb-1" style={{ fontSize: '0.6rem' }}>
            Meant instead of {displayLabel}?
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {topK
              .filter((t) => t.label && t.label !== displayLabel)
              .slice(0, 4)
              .map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                  onClick={() => submitWrong(t.label)}
                >
                  {t.label}
                </button>
              ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              maxLength={12}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value.toUpperCase())}
              placeholder="Letter…"
              className="btn-secondary flex-1"
              style={{ padding: '4px 6px', fontSize: '0.7rem', minHeight: 28 }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '4px 8px', fontSize: '0.65rem' }}
              disabled={!customLabel.trim()}
              onClick={() => submitWrong(customLabel.trim())}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {lockInEnabled && displayLabel && !compact && (
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.5rem',
            color: '#00ff88',
            textAlign: 'center',
            maxWidth: 48,
            lineHeight: 1.2,
          }}
        >
          {displayLabel}
          <br />
          {(displayConfidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  )
}
