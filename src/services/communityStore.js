import seedData from '../data/communitySeed.json'

const STORAGE_KEY = 'lxi_community_submissions'
const ADMIN_KEY = 'lxi_community_admin_unlocked'
/** Default moderator PIN — change in localStorage key lxi_community_pin */
const DEFAULT_PIN = '8942'

export const COMMUNITY_STATUSES = ['pending', 'review', 'approved', 'rejected']

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return null
}

function saveAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function mergeSeed(items) {
  const ids = new Set(items.map((i) => i.id))
  const merged = [...items]
  for (const s of seedData) {
    if (!ids.has(s.id)) merged.push({ ...s })
  }
  return merged
}

export function getSubmissions() {
  const existing = loadRaw()
  const items = existing ? mergeSeed(existing) : [...seedData]
  if (!existing) saveAll(items)
  return items.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
}

export function getStats(items = getSubmissions()) {
  const approved = items.filter((i) => i.status === 'approved').length
  const votes = items.reduce((s, i) => s + (i.upvotes || 0), 0)
  return {
    signs: items.length,
    votes,
    approved,
    pending: items.filter((i) => i.status === 'pending' || i.status === 'review').length,
  }
}

export function upvote(id) {
  const items = getSubmissions()
  const idx = items.findIndex((i) => i.id === id)
  if (idx < 0) return items
  items[idx] = { ...items[idx], upvotes: (items[idx].upvotes || 0) + 1 }
  saveAll(items)
  return items
}

export function setStatus(id, status) {
  const items = getSubmissions()
  const idx = items.findIndex((i) => i.id === id)
  if (idx < 0) return items
  items[idx] = { ...items[idx], status, reviewedAt: new Date().toISOString() }
  saveAll(items)
  return items
}

export function submitSign({ word, category, submitter, city, note = '' }) {
  const items = getSubmissions()
  const entry = {
    id: `user_${Date.now()}`,
    word: String(word).trim().toUpperCase(),
    category: category || 'Community',
    video: null,
    submitter: submitter || 'Anonymous',
    city: city || '',
    note,
    upvotes: 0,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    seed: false,
  }
  items.unshift(entry)
  saveAll(items)
  return entry
}

export function getAdminPin() {
  return localStorage.getItem('lxi_community_pin') || DEFAULT_PIN
}

export function verifyPin(pin) {
  const ok = String(pin).trim() === getAdminPin()
  if (ok) sessionStorage.setItem(ADMIN_KEY, '1')
  return ok
}

export function isAdminUnlocked() {
  return sessionStorage.getItem(ADMIN_KEY) === '1'
}

export function lockAdmin() {
  sessionStorage.removeItem(ADMIN_KEY)
}
