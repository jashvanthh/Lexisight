import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PHRASE_PACKS } from '../data/phrasePacks.js'
import { useTranslation } from '../hooks/useTranslation.js'
import {
  getSubmissions,
  getStats,
  upvote,
  setStatus,
  submitSign,
  verifyPin,
  isAdminUnlocked,
  lockAdmin,
} from '../services/communityStore.js'

const STATUS_STYLE = {
  approved: { color: '#00ff88', bg: 'rgba(0,255,136,0.08)', label: '✓ Approved' },
  review: { color: '#ffaa00', bg: 'rgba(255,170,0,0.08)', label: '⏳ In Review' },
  pending: { color: 'var(--text-secondary)', bg: 'rgba(107,139,164,0.06)', label: '○ Pending' },
  rejected: { color: '#ff3366', bg: 'rgba(255,51,102,0.08)', label: '✕ Rejected' },
}

function videoSrc(path) {
  if (!path) return ''
  return encodeURI(path.startsWith('/') ? path : `/${path}`)
}

function SignCard({ sign, adminMode, onUpvote, onStatus }) {
  const st = STATUS_STYLE[sign.status] || STATUS_STYLE.pending
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      {sign.video ? (
        <video
          src={videoSrc(sign.video)}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', display: 'block', background: '#000' }}
          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => {
            e.currentTarget.pause()
            e.currentTarget.currentTime = 0
          }}
        />
      ) : (
        <div
          style={{
            aspectRatio: '16/10',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.75rem',
          }}
        >
          Awaiting video upload
        </div>
      )}
      <div style={{ padding: '0.875rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
              {sign.word}
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              by {sign.submitter} · {sign.city}
              {sign.category ? ` · ${sign.category}` : ''}
            </div>
          </div>
          <span
            style={{
              fontSize: '0.65rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: st.color,
              background: st.bg,
              border: `1px solid ${st.color}25`,
              borderRadius: 20,
              padding: '3px 8px',
              flexShrink: 0,
            }}
          >
            {st.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
            onClick={() => onUpvote(sign.id)}
          >
            ▲ {sign.upvotes || 0}
          </button>
          {adminMode && sign.status !== 'approved' && (
            <button
              type="button"
              className="btn-primary"
              style={{ fontSize: '0.7rem', padding: '4px 10px' }}
              onClick={() => onStatus(sign.id, 'approved')}
            >
              Approve
            </button>
          )}
          {adminMode && sign.status !== 'review' && sign.status !== 'approved' && (
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.7rem', padding: '4px 10px' }}
              onClick={() => onStatus(sign.id, 'review')}
            >
              Review
            </button>
          )}
          {adminMode && sign.status !== 'rejected' && (
            <button
              type="button"
              style={{
                fontSize: '0.7rem',
                padding: '4px 10px',
                background: 'transparent',
                border: '1px solid #ff336640',
                color: '#ff3366',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onClick={() => onStatus(sign.id, 'rejected')}
            >
              Reject
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PinModal({ onClose, onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (verifyPin(pin)) {
      onSuccess()
      onClose()
    } else {
      setError('Incorrect PIN')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'color-mix(in srgb, var(--void) 60%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <form
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{ width: 'min(360px, 96vw)', padding: '1.5rem' }}
      >
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, marginBottom: 8 }}>Moderator access</h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Enter the review PIN to approve or reject community submissions.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value)
            setError('')
          }}
          placeholder="PIN"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--obsidian)',
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        />
        {error && (
          <p style={{ color: '#ff3366', fontSize: '0.8rem', marginBottom: 8 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>
            Unlock
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Community() {
  const { t } = useTranslation()
  const [items, setItems] = useState(() => getSubmissions())
  const [filter, setFilter] = useState('all')
  const [adminMode, setAdminMode] = useState(() => isAdminUnlocked())
  const [showPin, setShowPin] = useState(false)
  const [form, setForm] = useState({ word: '', submitter: '', city: '', category: '' })

  const refresh = useCallback(() => setItems(getSubmissions()), [])
  const stats = useMemo(() => getStats(items), [items])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'queue') return items.filter((i) => i.status === 'pending' || i.status === 'review')
    return items.filter((i) => i.status === filter)
  }, [items, filter])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.word.trim()) return
    submitSign(form)
    setForm({ word: '', submitter: '', city: '', category: '' })
    refresh()
  }

  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: '2rem' }}>
          <div>
            <div className="hud-label" style={{ marginBottom: '0.5rem' }}>SDG 17 · Partnerships for the Goals</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem,6vw,3.5rem)', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {t('comm_title')}
            </h1>
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 560 }}>
              {t('comm_subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {adminMode ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  lockAdmin()
                  setAdminMode(false)
                }}
              >
                Lock review mode
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setShowPin(true)}>
                Review mode (PIN)
              </button>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {[
            { n: stats.signs, label: t('comm_stats_signs'), color: 'var(--cyan)' },
            { n: stats.votes, label: t('comm_stats_votes'), color: '#00ff88' },
            { n: stats.approved, label: t('comm_stats_approved'), color: '#8b5cf6' },
            { n: stats.pending, label: 'In queue', color: '#ffaa00' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.6rem', color: s.color }}>{s.n}</div>
              <div className="hud-label">{s.label}</div>
            </div>
          ))}
        </div>

        {adminMode && (
          <div
            className="glass-card"
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderLeft: '3px solid #ffaa00',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            Review mode active — approve submissions to add them to the featured bank. Default PIN: 8942
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {['all', 'approved', 'review', 'pending', 'queue'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${filter === f ? 'var(--cyan)' : 'var(--border)'}`,
                background: filter === f ? 'color-mix(in srgb, var(--cyan) 12%, transparent)' : 'transparent',
                color: filter === f ? 'var(--cyan)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '0.8rem',
                textTransform: 'capitalize',
              }}
            >
              {f === 'queue' ? 'Review queue' : f}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
            marginBottom: '3rem',
          }}
        >
          {filtered.map((sign) => (
            <SignCard
              key={sign.id}
              sign={sign}
              adminMode={adminMode}
              onUpvote={(id) => {
                upvote(id)
                refresh()
              }}
              onStatus={(id, status) => {
                setStatus(id, status)
                refresh()
              }}
            />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <form className="glass-card" onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
            <div className="hud-label" style={{ marginBottom: '0.75rem' }}>Submit a sign</div>
            <input
              required
              placeholder="Sign word (e.g. HELLO)"
              value={form.word}
              onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))}
              style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--obsidian)', color: 'var(--text-primary)' }}
            />
            <input
              placeholder="Your name"
              value={form.submitter}
              onChange={(e) => setForm((f) => ({ ...f, submitter: e.target.value }))}
              style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--obsidian)', color: 'var(--text-primary)' }}
            />
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--obsidian)', color: 'var(--text-primary)' }}
            />
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
              Submit for review
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 8 }}>
              Or record landmarks on the <Link to="/train">Train</Link> page and open a GitHub issue.
            </p>
          </form>

          <div>
            <div className="hud-label" style={{ marginBottom: '0.75rem' }}>{t('comm_how_title')}</div>
            {[
              { step: '01', title: 'Record the Sign', desc: 'Use Train to capture landmark samples with your webcam.', icon: '📷' },
              { step: '02', title: 'Submit here or GitHub', desc: 'Post to the community queue or open a GitHub issue with your JSON.', icon: '📦' },
              { step: '03', title: 'Moderator review', desc: 'PIN-protected reviewers approve signs that match ISL standards.', icon: '🔒' },
              { step: '04', title: 'Ship to model', desc: 'Approved signs are merged into future LexiSight training runs.', icon: '✅' },
            ].map((s) => (
              <div key={s.step} className="glass-card" style={{ padding: '1rem', marginBottom: 8, display: 'flex', gap: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.9rem' }}>{s.title}</div>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{s.desc}</p>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <Link to="/train" className="btn-primary" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem' }}>
                📷 Record
              </Link>
              <a
                href="https://github.com/jashvanthh/Lexisight/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', textDecoration: 'none' }}
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <div className="hud-label" style={{ marginBottom: '0.75rem' }}>Built-In Domain Phrase Packs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {PHRASE_PACKS.map((pack) => (
              <div key={pack.id} className="glass-card" style={{ padding: '1.25rem', borderTop: `2px solid ${pack.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: '1.4rem' }}>{pack.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>{pack.label}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: pack.color }}>{pack.sdgLabel}</div>
                  </div>
                </div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{pack.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPin && (
        <PinModal
          onClose={() => setShowPin(false)}
          onSuccess={() => setAdminMode(true)}
        />
      )}
    </div>
  )
}
