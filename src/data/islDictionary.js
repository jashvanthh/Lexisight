/**
 * LexiSight ISL Visual Dictionary
 * Searchable reference for all supported gestures
 */

export const ISL_DICTIONARY = [
  // ── Letters ──────────────────────────────────────────────────
  { id: 'A', label: 'A', category: 'alphabet', description: 'Both hands: tight fists, thumb tips touching', fingers: { thumb: 'touch', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '✊✊' },
  { id: 'B', label: 'B', category: 'alphabet', description: 'Four fingers straight up together, thumb across palm', fingers: { thumb: 'across', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '🖐️' },
  { id: 'C', label: 'C', category: 'alphabet', description: 'Hand curved into a C shape', fingers: { thumb: 'curve', index: 'curve', middle: 'curve', ring: 'curve', pinky: 'curve' }, emoji: '🤏' },
  { id: 'D', label: 'D', category: 'alphabet', description: 'Index up, others circle with thumb', fingers: { thumb: 'circle', index: 'up', middle: 'circle', ring: 'circle', pinky: 'circle' }, emoji: '☝️' },
  { id: 'E', label: 'E', category: 'alphabet', description: 'All fingertips curled to touch thumb', fingers: { thumb: 'up', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '🤌' },
  { id: 'F', label: 'F', category: 'alphabet', description: 'Index and thumb touch, others extend', fingers: { thumb: 'pinch', index: 'pinch', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '👌' },
  { id: 'G', label: 'G', category: 'alphabet', description: 'Index and thumb point sideways', fingers: { thumb: 'side', index: 'side', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '👉' },
  { id: 'H', label: 'H', category: 'alphabet', description: 'Index and middle side by side, pointing sideways', fingers: { thumb: 'curl', index: 'side', middle: 'side', ring: 'curl', pinky: 'curl' }, emoji: '✌️' },
  { id: 'I', label: 'I', category: 'alphabet', description: 'Pinky finger extended up only', fingers: { thumb: 'curl', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'up' }, emoji: '🤙' },
  { id: 'K', label: 'K', category: 'alphabet', description: 'Index and middle extended with thumb between', fingers: { thumb: 'middle', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, emoji: '✌️' },
  { id: 'L', label: 'L', category: 'alphabet', description: 'Thumb up, index points forward — L shape', fingers: { thumb: 'up', index: 'forward', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '🤙' },
  { id: 'O', label: 'O', category: 'alphabet', description: 'All fingers and thumb form an O circle', fingers: { thumb: 'circle', index: 'circle', middle: 'circle', ring: 'circle', pinky: 'circle' }, emoji: '👌' },
  { id: 'S', label: 'S', category: 'alphabet', description: 'Fist with thumb across front of fingers', fingers: { thumb: 'front', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '✊' },
  { id: 'V', label: 'V', category: 'alphabet', description: 'Index and middle spread in V / peace sign', fingers: { thumb: 'curl', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, emoji: '✌️' },
  { id: 'W', label: 'W', category: 'alphabet', description: 'Index, middle and ring extended and spread', fingers: { thumb: 'curl', index: 'up', middle: 'up', ring: 'up', pinky: 'curl' }, emoji: '🖖' },
  { id: 'Y', label: 'Y', category: 'alphabet', description: 'Thumb and pinky extended — shaka / hang loose', fingers: { thumb: 'up', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'up' }, emoji: '🤙' },

  // ── Numbers ────────────────────────────────────────────────────
  { id: '0', label: '0', category: 'numbers', description: 'O shape — index and thumb form circle', fingers: { thumb: 'circle', index: 'circle', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '👌' },
  { id: '1', label: '1', category: 'numbers', description: 'Index finger pointing straight up', fingers: { thumb: 'curl', index: 'up', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '☝️' },
  { id: '2', label: '2', category: 'numbers', description: 'Index and middle fingers extended', fingers: { thumb: 'curl', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, emoji: '✌️' },
  { id: '3', label: '3', category: 'numbers', description: 'Thumb, index and middle extended', fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, emoji: '🤟' },
  { id: '4', label: '4', category: 'numbers', description: 'Four fingers up, thumb across palm', fingers: { thumb: 'across', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '🖐️' },
  { id: '5', label: '5', category: 'numbers', description: 'Open hand — all five fingers spread', fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '🖐️' },

  // ── Common words ───────────────────────────────────────────────
  { id: 'HELLO', label: 'HELLO', category: 'greetings', description: 'Open hand flat, wave side to side from ear', fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '👋' },
  { id: 'THANK YOU', label: 'THANK YOU', category: 'greetings', description: 'Flat hand from lips sweeping outward', fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '🙏' },
  { id: 'PLEASE', label: 'PLEASE', category: 'greetings', description: 'Flat palm on chest, circular motion', fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '🤲' },
  { id: 'SORRY', label: 'SORRY', category: 'greetings', description: 'Fist on chest, circular rubbing motion', fingers: { thumb: 'front', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '😔' },
  { id: 'YES', label: 'YES', category: 'greetings', description: 'Fist nodding forward like a head nod', fingers: { thumb: 'side', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '👍' },
  { id: 'NO', label: 'NO', category: 'greetings', description: 'Index and middle tap thumb twice', fingers: { thumb: 'up', index: 'side', middle: 'side', ring: 'curl', pinky: 'curl' }, emoji: '🙅' },
  { id: 'GOOD', label: 'GOOD', category: 'greetings', description: 'Thumbs up with slight forward motion', fingers: { thumb: 'up', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '👍' },
  { id: 'HELP', label: 'HELP', category: 'emergency', description: 'Closed fist on open palm, raise upward', fingers: { thumb: 'up', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '🆘' },
  { id: 'STOP', label: 'STOP', category: 'emergency', description: 'Open palm facing forward, push outward', fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '✋' },
  { id: 'PAIN', label: 'PAIN', category: 'medical', description: 'Both index fingers point at each other and twist', fingers: { thumb: 'curl', index: 'forward', middle: 'curl', ring: 'curl', pinky: 'curl' }, emoji: '😣' },
  { id: 'WATER', label: 'WATER', category: 'medical', description: 'W hand taps chin twice', fingers: { thumb: 'curl', index: 'up', middle: 'up', ring: 'up', pinky: 'curl' }, emoji: '💧' },
  { id: 'FOOD', label: 'FOOD', category: 'medical', description: 'Flat hand taps lips/mouth area', fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, emoji: '🍽️' },
  { id: 'ILY', label: 'I LOVE YOU', category: 'common', description: 'Thumb, index and pinky extended — ILY sign', fingers: { thumb: 'up', index: 'up', middle: 'curl', ring: 'curl', pinky: 'up' }, emoji: '🤟' },
  { id: 'ROCK', label: 'ROCK / COOL', category: 'common', description: 'Index and pinky up — rock horns', fingers: { thumb: 'curl', index: 'up', middle: 'curl', ring: 'curl', pinky: 'up' }, emoji: '🤘' },
]

export const DICTIONARY_CATEGORIES = [
  { id: 'all', label: 'All Signs', color: '#e8f4fd' },
  { id: 'alphabet', label: 'Alphabet', color: '#00d4ff' },
  { id: 'numbers', label: 'Numbers', color: '#00ff88' },
  { id: 'greetings', label: 'Greetings', color: '#8b5cf6' },
  { id: 'medical', label: 'Medical', color: '#ff3366' },
  { id: 'emergency', label: 'Emergency', color: '#ffaa00' },
  { id: 'common', label: 'Common', color: '#00d4ff' },
]

export const searchDictionary = (query, category = 'all') => {
  const q = query.toLowerCase().trim()
  return ISL_DICTIONARY.filter(item => {
    const matchCat = category === 'all' || item.category === category
    const matchQuery = !q || item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    return matchCat && matchQuery
  })
}
