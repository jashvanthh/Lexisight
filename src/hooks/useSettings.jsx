import { useState, useEffect, useCallback, createContext, useContext } from 'react'

// ── Default Settings ──────────────────────────────────────────────────────────
const DEFAULTS = {
  // ─── Language & Speech ───
  uiLanguage: 'en',
  speechLanguage: 'en',
  voiceGender: 'female',
  speechSpeed: 1.0,
  speechVolume: 1.0,
  speechPitch: 1.0,
  autoSpeak: true,
  muteAudio: false,
  micLanguage: 'en-IN',

  // ─── Sign Language ───
  signLanguage: 'isl',

  // ─── Camera ───
  cameraFacing: 'user',
  cameraResolution: '720p',
  fpsLimit: 30,
  autoStartCamera: false,
  autoStopCamera: true,
  idleTimeout: 120,

  // ─── Performance ───
  performanceMode: 'balanced',
  gpuAcceleration: true,
  aiBackend: 'webgl',
  batterySaver: false,
  offlineMode: true,
  autoModelUpdates: false,
  adaptivePerformance: true,

  // ─── Detection ───
  handOverlay: true,
  skeletonThickness: 2,
  landmarkSize: 4,
  skeletonColor: '#8b5cf6',
  showConfidence: true,
  smoothingLevel: 'medium',
  stabilityThreshold: 3,
  detectionSensitivity: 'balanced',
  gestureTimeout: 3,
  confidenceThreshold: 0.6,
  motionSmoothing: true,
  handTrackingSensitivity: 'balanced',
  lowLightEnhance: false,
  multiPersonFilter: true,
  singleHandMode: false,
  dominantHand: 'right',

  // ─── Translation ───
  sentenceAutoClear: true,
  sentenceClearTimer: 10,
  continuousMode: false,
  sentenceBuilder: true,
  grammarCorrection: true,
  autoPunctuation: true,
  duplicateFilter: true,
  predictionCooldown: 1.2,
  predictionLockIn: true,

  // ─── History ───
  translationHistory: true,
  historyLength: 50,

  // ─── Accessibility ───
  emergencyMode: false,
  largeText: false,
  highContrast: false,
  darkMode: true,
  fontSize: 'medium',
  hapticFeedback: true,
  soundFeedback: false,
  screenReader: false,
  leftHandedMode: false,
  animationReduction: false,
  minimalUI: false,

  // ─── Privacy ───
  privacyMode: true,
  disableAnalytics: true,
  localProcessing: true,

  // ─── Developer ───
  debugMode: false,
  showFPS: false,
  showInferenceSpeed: false,
  detectionLogs: false,

  // ─── AI Model ───
  modelTier: 'accurate',

  // ─── Emergency Phrases ───
  emergencyPhrases: ['HELP', 'WATER', 'DOCTOR', 'PAIN', 'BATHROOM', 'FOOD'],

  // ─── Favorite Phrases ───
  favoritePhrases: [],

  // ─── Fullscreen ───
  fullscreenMode: false,
}

const STORAGE_KEY = 'lxi_settings'

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.warn('LexiSight: Failed to load settings', e)
  }
  return { ...DEFAULTS }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('LexiSight: Failed to save settings', e)
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Apply global side effects
  useEffect(() => {
    document.documentElement.style.fontSize =
      settings.fontSize === 'small' ? '14px' :
      settings.fontSize === 'large' ? '18px' :
      settings.fontSize === 'extra-large' ? '20px' : '16px'

    if (settings.highContrast) {
      document.documentElement.classList.add('high-contrast')
    } else {
      document.documentElement.classList.remove('high-contrast')
    }

    if (settings.animationReduction) {
      document.documentElement.classList.add('reduce-motion')
    } else {
      document.documentElement.classList.remove('reduce-motion')
    }
  }, [settings.fontSize, settings.highContrast, settings.animationReduction])

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULTS })
  }, [])

  const exportSettings = useCallback(() => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lexisight_settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [settings])

  const importSettings = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        setSettings({ ...DEFAULTS, ...imported })
      } catch (err) {
        console.error('LexiSight: Invalid settings file', err)
      }
    }
    reader.readAsText(file)
  }, [])

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSetting,
      resetSettings,
      exportSettings,
      importSettings,
      DEFAULTS,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

export { DEFAULTS }
export default useSettings
