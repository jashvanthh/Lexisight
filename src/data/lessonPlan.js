/**
 * LexiSight ISL Learning Mode — Lesson Plan
 * SDG 4: Quality Education
 *
 * Structure: Chapter → Lesson → Signs
 * Each sign: { word, instruction, tip, passingScore }
 */

export const LESSON_PLAN = [
  {
    id: 'alphabet',
    title: 'ISL Alphabet',
    icon: '🔤',
    description: 'Learn the complete ISL fingerspelling alphabet (A–Z)',
    sdg: 4,
    color: '#00d4ff',
    xpReward: 100,
    lessons: [
      {
        id: 'alpha-basics',
        title: 'Vowels First',
        description: 'Start with A, E, I, O, U — the foundation',
        signs: [
          { word: 'A', instruction: 'Both hands: tight fists, touch thumb tips together', tip: 'Keep all fingers curled on both hands; only the thumb ends meet', passingScore: 0.65 },
          { word: 'E', instruction: 'Curl all fingers down touching your thumb', tip: 'All fingertips touch the thumb pad', passingScore: 0.65 },
          { word: 'I', instruction: 'Extend only your pinky finger up', tip: 'Keep all other fingers curled into your palm', passingScore: 0.70 },
          { word: 'O', instruction: 'Form a circle with your index and thumb tips touching', tip: 'The other fingers stay slightly curled', passingScore: 0.70 },
        ],
      },
      {
        id: 'alpha-common',
        title: 'Common Letters',
        description: 'B, C, D, L, V — frequently used',
        signs: [
          { word: 'B', instruction: 'Make an O on each hand (thumb + index circle) and touch the two O\'s together', tip: 'Like two small circles kissing — not a flat palm stack', passingScore: 0.55 },
          { word: 'C', instruction: 'Curve your hand into a C shape', tip: 'Like holding a can — don\'t close completely', passingScore: 0.70 },
          { word: 'D', instruction: 'Index finger points up, other fingers and thumb form a circle', tip: 'Thumb touches middle finger base — not a plain pointing "1"', passingScore: 0.55 },
          { word: 'L', instruction: 'Extend thumb up and index finger forward, form an L', tip: 'Like making a gun shape with your hand', passingScore: 0.75 },
          { word: 'V', instruction: 'Extend index and middle fingers in a V / peace sign', tip: 'Spread them apart slightly for a clear V', passingScore: 0.75 },
        ],
      },
      {
        id: 'alpha-advanced',
        title: 'Remaining Letters',
        description: 'Complete the full alphabet',
        signs: [
          { word: 'Y', instruction: 'Extend thumb and pinky, curl the rest', tip: 'Like a "hang loose" / shaka sign', passingScore: 0.72 },
          { word: 'W', instruction: 'Extend index, middle and ring fingers spread wide', tip: 'Like the number 3 but spread wider', passingScore: 0.70 },
          { word: 'M', instruction: 'Three fingers down: index, middle and ring pointing down', tip: 'Thumb and pinky tucked in — reverse of W (3 up)', passingScore: 0.55 },
          { word: 'N', instruction: 'Two fingers down: index and middle pointing down', tip: 'Ring and pinky tucked — one less finger than M', passingScore: 0.55 },
          { word: 'K', instruction: 'Index + middle on one hand; other thumb between them', tip: 'Two hands — base palm faces camera', passingScore: 0.58 },
          { word: 'S', instruction: 'Make a fist with thumb across the front of fingers', tip: 'Different from A — thumb covers your fingers', passingScore: 0.65 },
        ],
      },
    ],
  },
  {
    id: 'numbers',
    title: 'Numbers 0–9',
    icon: '🔢',
    description: 'Count and communicate numbers in ISL',
    sdg: 4,
    color: '#00ff88',
    xpReward: 80,
    lessons: [
      {
        id: 'nums-basic',
        title: 'Numbers 0–5',
        description: 'The first six digits',
        signs: [
          { word: '0', instruction: 'Form an O shape — index and thumb touch in a circle', tip: 'Same as the letter O — thumb and index form a circle', passingScore: 0.70 },
          { word: '1', instruction: 'Point your index finger straight up', tip: 'All other fingers curled, only index extends', passingScore: 0.80 },
          { word: '2', instruction: 'Extend index and middle fingers (peace sign)', tip: 'Keep them together, not spread apart', passingScore: 0.75 },
          { word: '3', instruction: 'Extend thumb, index and middle fingers', tip: 'Thumb, index, and middle — three spread fingers', passingScore: 0.72 },
          { word: '4', instruction: 'Extend all four fingers, thumb tucked in', tip: 'Four fingers spread open, thumb across palm', passingScore: 0.70 },
          { word: '5', instruction: 'Open hand — all five fingers spread wide', tip: 'Full open hand, like waving hello', passingScore: 0.80 },
        ],
      },
      {
        id: 'nums-advanced',
        title: 'Numbers 6–9',
        description: 'Higher digits',
        signs: [
          { word: '6', instruction: 'Only your little finger (pinky) sticks up — all other fingers in a fist', tip: 'Thumb tucked in; only pinky extended', passingScore: 0.55 },
          { word: '7', instruction: 'Bent index finger (hook shape), other fingers in a fist', tip: 'Index bends at the knuckle — not pointing straight up', passingScore: 0.55 },
          { word: '8', instruction: 'Thumb, index, and middle finger up — ring and pinky in a fist', tip: 'Like a three-finger salute with thumb out', passingScore: 0.55 },
          { word: '9', instruction: 'Thumbs down — thumb points downward, other fingers fisted', tip: 'Classic thumbs-down gesture; keep other fingers closed', passingScore: 0.55 },
        ],
      },
    ],
  },
  {
    id: 'greetings',
    title: 'Greetings',
    icon: '👋',
    description: 'Essential social greetings and responses',
    sdg: 10,
    color: '#8b5cf6',
    xpReward: 60,
    lessons: [
      {
        id: 'greet-basic',
        title: 'Essential Greetings',
        description: 'The most used social signs',
        signs: [
          { word: 'HELLO', instruction: 'Open hand flat, wave side to side near your cheek', tip: 'Relaxed open palm motion — friendly wave', passingScore: 0.75 },
          { word: 'GOOD', instruction: 'Thumb up with a slight forward motion', tip: 'A warm thumbs-up', passingScore: 0.80 },
          { word: 'YES', instruction: 'Make a fist and nod it forward like a head nod', tip: 'Small fist bouncing yes-yes motion', passingScore: 0.72 },
          { word: 'NO', instruction: 'Index and middle finger tap the thumb twice', tip: 'Like a talking gesture — tap tap', passingScore: 0.70 },
          { word: 'THANK YOU', instruction: 'Flat hand touches lips then extends forward', tip: 'Like throwing a kiss of gratitude outward', passingScore: 0.78 },
          { word: 'PLEASE', instruction: 'Flat palm on chest, circular motion', tip: 'Rub your chest in a circle', passingScore: 0.72 },
          { word: 'SORRY', instruction: 'Fist on chest, circular motion', tip: 'Make a fist and rub your heart area', passingScore: 0.72 },
          { word: 'HELP', instruction: 'Closed fist on open palm, raise both hands upward', tip: 'One hand helps lift the other', passingScore: 0.70 },
        ],
      },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency Signs',
    icon: '🚨',
    description: 'Critical safety and emergency communication — learn these first',
    sdg: 3,
    color: '#ff3366',
    xpReward: 120,
    lessons: [
      {
        id: 'emergency-vital',
        title: 'Life-Critical Signs',
        description: 'The signs that matter most in emergencies',
        signs: [
          { word: 'HELP', instruction: 'Closed fist on open palm — raise both hands urgently', tip: 'This is the most important sign to know', passingScore: 0.65 },
          { word: 'STOP', instruction: 'Open palm facing outward, push forward firmly', tip: 'Strong decisive push — command gesture', passingScore: 0.72 },
          { word: 'PAIN', instruction: 'Both index fingers point at each other and twist', tip: 'The twisting motion shows pain/discomfort', passingScore: 0.65 },
          { word: 'NO', instruction: 'Index and middle finger tap the thumb — firm', tip: 'Strong, clear refusal gesture', passingScore: 0.72 },
          { word: 'COME', instruction: 'Bent index finger beckons toward you', tip: 'Curl your index finger toward you repeatedly', passingScore: 0.70 },
          { word: 'GO', instruction: 'Bent index finger points and sweeps away from you', tip: 'Like pointing someone away from you', passingScore: 0.70 },
        ],
      },
    ],
  },
]

export const getTotalSigns = () =>
  LESSON_PLAN.reduce((acc, ch) =>
    acc + ch.lessons.reduce((a, l) => a + l.signs.length, 0), 0)

export const getTotalXP = () =>
  LESSON_PLAN.reduce((acc, ch) => acc + ch.xpReward, 0)

export const getChapterById = (id) => LESSON_PLAN.find(c => c.id === id)
