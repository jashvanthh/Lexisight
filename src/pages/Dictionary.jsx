import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation.js'
import libraryManifest from '../data/islVideoLibrary.slim.json'
import lettersNumbersManifest from '../data/islLettersNumbers.slim.json'

const PAGE_SIZE = 24

const INCLUDE_ITEMS = (libraryManifest.items ?? []).filter(
  (item) => item.source === 'INCLUDE' && !String(item.id).startsWith('cislr_'),
)

const LETTERS_ITEMS = lettersNumbersManifest.items?.filter((i) => i.library === 'letters') ?? []
const NUMBERS_ITEMS = lettersNumbersManifest.items?.filter((i) => i.library === 'numbers') ?? []
const LIBRARY_MEDIA_V = lettersNumbersManifest.mediaVersion ?? ''

const LIBRARIES = [
  {
    id: 'include',
    title: 'INCLUDE Full',
    icon: '📚',
    accent: 'var(--green)',
    folder: 'library/include',
    items: INCLUDE_ITEMS,
  },
  {
    id: 'letters',
    title: lettersNumbersManifest.libraries?.letters?.title ?? 'Alphabet A–Z',
    icon: lettersNumbersManifest.libraries?.letters?.icon ?? '🔤',
    accent: lettersNumbersManifest.libraries?.letters?.accent ?? '#8b5cf6',
    folder: lettersNumbersManifest.libraries?.letters?.folder ?? 'library/letters',
    items: LETTERS_ITEMS,
  },
  {
    id: 'numbers',
    title: lettersNumbersManifest.libraries?.numbers?.title ?? 'Numbers 0–9',
    icon: lettersNumbersManifest.libraries?.numbers?.icon ?? '🔢',
    accent: lettersNumbersManifest.libraries?.numbers?.accent ?? '#00ff88',
    folder: lettersNumbersManifest.libraries?.numbers?.folder ?? 'library/numbers',
    items: NUMBERS_ITEMS,
  },
]

function formatLabel(label) {
  return String(label || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mediaSrc(path, bustCache = false) {
  if (!path) return ''
  const base = encodeURI(path.startsWith('/') ? path : `/${path}`)
  if (bustCache && LIBRARY_MEDIA_V) {
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}v=${LIBRARY_MEDIA_V}`
  }
  return base
}

function isImageMedia(item) {
  if (item.mediaType === 'image') return true
  return /\.(jpe?g|png|webp|gif|svg)$/i.test(item.video || '')
}

function placeholderSrc(item) {
  const folder = item.library === 'numbers' ? 'numbers' : 'letters'
  const name = String(item.label).replace(/[^A-Za-z0-9]/g, '') || 'SIGN'
  return mediaSrc(`/dictionary-media/${folder}/${name}.svg`)
}

/** Prefer manifest path (built from dataset); library jpg is the canonical photo path. */
function primaryMediaSrc(item) {
  const bust = item.library === 'letters' || item.library === 'numbers'
  if (item.video?.startsWith('/library/')) {
    return mediaSrc(item.video, bust)
  }
  const name = String(item.label).replace(/[^A-Za-z0-9]/g, '') || 'SIGN'
  if (item.library === 'letters' || item.library === 'numbers') {
    return mediaSrc(`/library/${item.library}/${name}.jpg`, true)
  }
  return mediaSrc(item.video)
}

function mediaFallbacks(item) {
  const list = [primaryMediaSrc(item)]
  const manifest = mediaSrc(item.video)
  if (!list.includes(manifest)) list.push(manifest)
  const ph = placeholderSrc(item)
  if (!list.includes(ph)) list.push(ph)
  return list
}

const SignCard = memo(function SignCard({ item, accent, onOpen }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  const fallbacks = useMemo(() => mediaFallbacks(item), [item])
  const [fbIdx, setFbIdx] = useState(0)
  const imgSrc = fallbacks[Math.min(fbIdx, fallbacks.length - 1)]
  const { t } = useTranslation()
  const isImage = isImageMedia(item) || item.library === 'letters' || item.library === 'numbers'

  useEffect(() => {
    setFbIdx(0)
  }, [item.id, item.video])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <button
      type="button"
      ref={ref}
      onClick={() => onOpen(item)}
      className="glass-card"
      style={{
        padding: 0,
        border: '1px solid var(--border)',
        borderTop: `2px solid color-mix(in srgb, ${accent} 35%, transparent)`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = `0 12px 32px color-mix(in srgb, ${accent} 12%, transparent)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 11',
          background: 'var(--surface)',
          overflow: 'hidden',
        }}
      >
        {inView ? (
          isImage ? (
            <img
              src={imgSrc}
              alt={formatLabel(item.label)}
              loading="lazy"
              onError={() => setFbIdx((i) => Math.min(i + 1, fallbacks.length - 1))}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <video
              src={mediaSrc(item.video)}
              muted
              loop
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => {
                e.currentTarget.pause()
                e.currentTarget.currentTime = 0
              }}
            />
          )
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent,
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: '2.5rem',
            }}
          >
            {formatLabel(item.label).charAt(0) || '…'}
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: '0.7rem',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: accent,
            background: 'color-mix(in srgb, var(--void) 75%, transparent)',
            border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
            borderRadius: 20,
            padding: '5px 10px',
          }}
        >
          {t('dict_click_learn')}
        </span>
      </div>
      <div style={{ padding: '1rem 1.15rem 1.15rem' }}>
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          {formatLabel(item.label)}
        </div>
        <div
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            textTransform: 'capitalize',
          }}
        >
          {formatLabel(item.category)}
        </div>
      </div>
    </button>
  )
})

function LearnModal({ item, accent, onClose }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const isImage = isImageMedia(item) || item.library === 'letters' || item.library === 'numbers'
  const fallbacks = useMemo(() => mediaFallbacks(item), [item])
  const [fbIdx, setFbIdx] = useState(0)
  const imgSrc = fallbacks[Math.min(fbIdx, fallbacks.length - 1)]

  useEffect(() => {
    setFbIdx(0)
  }, [item.id, item.video])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!isImage) videoRef.current?.play().catch(() => {})
  }, [item, isImage])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={formatLabel(item.label)}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'color-mix(in srgb, var(--void) 55%, transparent)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 96vw)',
          padding: 0,
          overflow: 'hidden',
          borderTop: `2px solid color-mix(in srgb, ${accent} 45%, transparent)`,
        }}
      >
        {isImage ? (
          <img
            src={imgSrc}
            alt={formatLabel(item.label)}
            onError={() => setFbIdx((i) => Math.min(i + 1, fallbacks.length - 1))}
            style={{
              width: '100%',
              display: 'block',
              background: '#000',
              maxHeight: 'min(75vh, 560px)',
              objectFit: 'contain',
            }}
          />
        ) : (
          <video
            ref={videoRef}
            src={mediaSrc(item.video)}
            controls
            autoPlay
            loop
            playsInline
            style={{
              width: '100%',
              display: 'block',
              background: '#000',
              maxHeight: 'min(75vh, 560px)',
              objectFit: 'contain',
            }}
          />
        )}
        <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {formatLabel(item.label)}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-secondary)',
                width: 36,
                height: 36,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            {formatLabel(item.category)} · {item.source}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/translate" className="btn-primary" style={{ fontSize: '0.85rem', flex: 1, textAlign: 'center', minWidth: 140 }}>
              {t('dict_go_translator')} →
            </Link>
            <Link to="/learn" className="btn-secondary" style={{ fontSize: '0.85rem', flex: 1, textAlign: 'center', minWidth: 140 }}>
              {t('dict_btn_learn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dictionary() {
  const { t } = useTranslation()
  const [libraryId, setLibraryId] = useState('include')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState(null)

  const activeLibrary = useMemo(
    () => LIBRARIES.find((lib) => lib.id === libraryId) ?? LIBRARIES[0],
    [libraryId],
  )
  const accent = activeLibrary.accent

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 200)
    return () => clearTimeout(id)
  }, [query])

  const categories = useMemo(() => {
    const set = new Set()
    activeLibrary.items.forEach((item) => {
      if (item.category) set.add(item.category)
    })
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))]
  }, [activeLibrary.items])

  useEffect(() => {
    setCategory('all')
    setVisibleCount(PAGE_SIZE)
    setQuery('')
  }, [libraryId])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [debouncedQuery, category])

  const filtered = useMemo(() => {
    let list = activeLibrary.items
    if (category !== 'all') {
      list = list.filter((item) => item.category === category)
    }
    if (debouncedQuery) {
      list = list.filter((item) => {
        const label = formatLabel(item.label).toLowerCase()
        const cat = formatLabel(item.category).toLowerCase()
        return label.includes(debouncedQuery) || cat.includes(debouncedQuery)
      })
    }
    return list
  }, [activeLibrary.items, category, debouncedQuery])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = visibleCount < filtered.length

  const openItem = useCallback((item) => setSelected(item), [])
  const closeModal = useCallback(() => setSelected(null), [])

  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
      <section style={{ padding: '2.5rem 1.5rem 3rem', maxWidth: 1440, margin: '0 auto' }}>
        <div className="hud-label" style={{ marginBottom: '0.5rem' }}>
          ISL Video Library
        </div>
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--cyan) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '0.5rem',
          }}
        >
          {t('dict_title')}
        </h1>
        <p
          style={{
            fontFamily: 'DM Sans, sans-serif',
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            maxWidth: 640,
            marginBottom: '1.75rem',
            lineHeight: 1.55,
          }}
        >
          {t('dict_subtitle_video')}
        </p>

        {/* Library folders — same pattern as INCLUDE, plus Letters & Numbers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 10,
            marginBottom: '1.25rem',
          }}
        >
          {LIBRARIES.map((lib) => {
            const active = lib.id === libraryId
            return (
              <button
                key={lib.id}
                type="button"
                onClick={() => setLibraryId(lib.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: active
                    ? `color-mix(in srgb, ${lib.accent} 12%, transparent)`
                    : 'var(--obsidian)',
                  border: `1px solid ${active ? lib.accent : 'var(--border)'}`,
                  borderTop: `2px solid ${active ? lib.accent : 'var(--border)'}`,
                  transition: 'border-color 0.2s ease, background 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{lib.icon}</span>
                  <span
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      color: active ? lib.accent : 'var(--text-primary)',
                    }}
                  >
                    {lib.title}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.62rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {lib.folder} · {lib.items.length} signs
                </div>
              </button>
            )
          })}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('dict_search_placeholder')}
          aria-label={t('dict_search_placeholder')}
          style={{
            width: '100%',
            maxWidth: 560,
            background: 'var(--obsidian)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
            color: 'var(--text-primary)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.95rem',
            outline: 'none',
            marginBottom: '1rem',
          }}
        />

        {libraryId === 'include' && categories.length > 2 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              paddingBottom: 8,
              marginBottom: '1rem',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {categories.map((cat) => {
              const active = category === cat
              const label = cat === 'all' ? t('dict_category_all') : formatLabel(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    flexShrink: 0,
                    background: active ? `color-mix(in srgb, ${accent} 15%, transparent)` : 'transparent',
                    border: `1px solid ${active ? accent : 'var(--border)'}`,
                    borderRadius: 20,
                    padding: '6px 14px',
                    color: active ? accent : 'var(--text-secondary)',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        <div className="hud-label" style={{ marginBottom: '1rem' }}>
          {t('dict_showing')} {visible.length.toLocaleString()} / {filtered.length.toLocaleString()}
        </div>

        {visible.length > 0 ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  libraryId === 'include'
                    ? 'repeat(auto-fill, minmax(280px, 1fr))'
                    : 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '1.35rem',
              }}
            >
              {visible.map((item) => (
                <SignCard key={item.id} item={item} accent={accent} onOpen={openItem} />
              ))}
            </div>
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  style={{ fontSize: '0.9rem', padding: '10px 28px' }}
                >
                  {t('dict_load_more')} ({Math.min(PAGE_SIZE, filtered.length - visibleCount)} more)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔍</div>
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)' }}>
              {t('dict_none')}
              {query ? ` "${query}"` : ''}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setCategory('all')
              }}
              className="btn-secondary"
              style={{ marginTop: '1rem', fontSize: '0.8rem' }}
            >
              {t('dict_btn_clear')}
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: '3rem',
            textAlign: 'center',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/learn" className="btn-primary" style={{ fontSize: '0.85rem' }}>
            {t('dict_btn_learn')} →
          </Link>
          <Link to="/translate" className="btn-secondary" style={{ fontSize: '0.85rem' }}>
            {t('dict_go_translator')} →
          </Link>
        </div>
      </section>

      {selected && <LearnModal item={selected} accent={accent} onClose={closeModal} />}
    </div>
  )
}
