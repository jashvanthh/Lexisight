/**
 * PredictionSmoother — prevents prediction flickering
 * Uses a sliding window vote with confidence weighting
 */
export class PredictionSmoother {
  constructor(windowSize = 10, threshold = 0.75, opts = {}) {
    this.history = []
    this.windowSize = windowSize
    this.threshold = threshold
    this.lockDuration = opts.lockFrames ?? 45
    this.minVoteWeight = opts.minVoteWeight ?? null
    this.lastConfirmed = null
    this.lockFrames = 0
    this.framesSinceLast = 0
  }

  add(prediction) {
    if (!prediction) {
      this.framesSinceLast++
      if (this.framesSinceLast > 15) {
        this.lastConfirmed = null
        this.history = []
      }
      return this.lastConfirmed
    }

    this.framesSinceLast = 0

    // Ignore live previews — only full-buffer predictions can confirm a word
    if (prediction.isPreview) {
      return this.lastConfirmed
    }

    // Hold confirmed label during lock (no early release on high-confidence flicker)
    if (this.lockFrames > 0) {
      this.lockFrames--
      return this.lastConfirmed
    }

    this.history.push(prediction)
    if (this.history.length > this.windowSize) {
      this.history.shift()
    }

    // Weighted vote across window
    const votes = {}
    for (const p of this.history) {
      if (p.confidence > this.threshold) {
        votes[p.label] = (votes[p.label] || 0) + p.confidence
      }
    }

    if (Object.keys(votes).length === 0) return null

    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1])
    const [winnerLabel, winnerScore] = sorted[0]
    const voteTotal = Object.values(votes).reduce((a, b) => a + b, 0)
    const avgConf = winnerScore / Math.max(1, this.history.length)

    const minWeight = this.minVoteWeight ?? this.threshold * this.windowSize * 0.45
    if (voteTotal >= minWeight && avgConf > this.threshold * 0.85) {
      const newConfirmed = {
        label: winnerLabel,
        confidence: Math.min(0.99, avgConf),
        topK: prediction.topK || this.lastConfirmed?.topK,
      }
      if (!this.lastConfirmed || winnerLabel !== this.lastConfirmed.label) {
        this.lastConfirmed = newConfirmed
        this.lockFrames = this.lockDuration
        return this.lastConfirmed
      }
    }

    return this.lastConfirmed
  }

  reset() {
    this.history = []
    this.lastConfirmed = null
    this.lockFrames = 0
    this.framesSinceLast = 0
  }

  get isLocked() {
    return this.lockFrames > 0
  }

  get stability() {
    if (this.history.length < 3) return 0
    const labels = this.history.map(p => p.label)
    const mode = labels.sort((a, b) =>
      labels.filter(v => v === a).length - labels.filter(v => v === b).length
    ).pop()
    const consistency = labels.filter(v => v === mode).length / labels.length
    return consistency
  }
}

/**
 * Sentence builder — accumulates confirmed gestures into sentences
 */
export class SentenceBuilder {
  constructor(silenceThreshold = 2000) {
    this.words = []
    this.lastWordTime = null
    this.silenceThreshold = silenceThreshold
    this.onSentenceComplete = null
  }

  addWord(word) {
    const now = Date.now()
    if (this.lastWordTime && (now - this.lastWordTime) > this.silenceThreshold) {
      // Silence gap — complete previous sentence if long enough
      if (this.words.length >= 2 && this.onSentenceComplete) {
        this.onSentenceComplete(this.getSentence())
        this.words = []
      }
    }

    // Don't repeat same word twice in a row
    if (this.words.length > 0 && this.words[this.words.length - 1] !== word) {
      this.words.push(word)
    } else if (this.words.length === 0) {
      this.words.push(word)
    }

    this.lastWordTime = now
    return this.getSentence()
  }

  getSentence() {
    const gloss = this.words.join(' ')
    return this.applyGrammarFixes(gloss)
  }

  applyGrammarFixes(gloss) {
    if (!gloss) return ''
    let out = gloss.toLowerCase()
    
    // ISL Gloss → Basic English heuristics
    // Question words
    if (out.includes('name you what') || out.includes('your name what')) return 'What is your name?'
    if (out.includes('you how') || out.includes('how you')) return 'How are you?'
    if (out.includes('time what')) return 'What time is it?'
    if (out.includes('where go')) return 'Where are you going?'
    if (out.includes('what happened')) return 'What happened?'

    // Common verb phrasing
    out = out.replace(/i (water|food|drink|eat) (want|need|please)/g, 'I want $1')
    out = out.replace(/(water|food|drink|eat) (please|want)/g, 'Please give me $1')
    out = out.replace(/i (doctor|help) (want|need)/g, 'I need a $1')
    out = out.replace(/i pain/g, 'I am in pain')
    
    // Basic cleanup
    out = out.replace(/i /g, 'I ')
    
    // Capitalize first letter
    return out.charAt(0).toUpperCase() + out.slice(1)
  }

  clear() {
    this.words = []
    this.lastWordTime = null
  }

  get wordCount() {
    return this.words.length
  }
}
