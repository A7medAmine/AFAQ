/**
 * The Technology department's member assessment: six interview questions,
 * each answered on a 0–3 scale (A–D). The total out of 18 places a member at
 * a level; a pro candidate also gets a short practical task before taking on
 * advanced work. Rows live in member_assessments.
 */

export const QUESTIONS = [
  {
    title: 'Practical Experience',
    prompt: 'What is the most advanced electronics, programming, or robotics project you have personally worked on?',
    options: [
      'I have not worked on a technical project yet.',
      'I have followed tutorials or assembled a simple project.',
      'I have built a project and can explain how it works.',
      'I have independently designed, modified, or debugged a project.',
    ],
  },
  {
    title: 'Electronics Fundamentals',
    prompt: 'Why is a resistor commonly connected in series with an LED?',
    options: [
      'I do not know.',
      'To protect the LED.',
      'To limit the current flowing through the LED.',
      "To limit current to a suitable value using supply voltage, LED forward voltage, and Ohm's law.",
    ],
  },
  {
    title: 'Programming Experience',
    prompt: 'What programming languages or development environments have you used, and what have you built with them?',
    options: [
      'I have not programmed before.',
      'I have copied or modified simple code.',
      'I can write and explain simple programs.',
      'I can structure, debug, and modify programs independently.',
    ],
  },
  {
    title: 'Troubleshooting',
    prompt: 'An ESP32 sensor is not producing readings. What would you do first?',
    options: [
      'I do not know how to start.',
      'I would restart the board or upload the code again.',
      'I would check the wiring, power, pins, and code.',
      'I would troubleshoot systematically: power, connections, communication, code, serial output, and sensor documentation.',
    ],
  },
  {
    title: 'Learning an Unfamiliar Project',
    prompt: 'You are asked to build a project using a component you have never used. What is your approach?',
    options: [
      'I would wait for someone to do it for me.',
      'I would search for a tutorial and copy it.',
      'I would study the documentation and follow a suitable example.',
      'I would research the component, check specs and wiring, build a small test, and improve step by step.',
    ],
  },
  {
    title: 'Technical Responsibility',
    prompt: 'If your team encounters a technical problem during a project, how would you contribute?',
    options: [
      'I would wait for instructions.',
      'I would help with simple assigned tasks.',
      'I would investigate the problem and help the team find a solution.',
      'I would investigate systematically, document findings, communicate with the team, and help verify the solution.',
    ],
  },
]

export const MAX_SCORE = QUESTIONS.length * 3
export const OPTION_LETTERS = 'ABCD'

/** Totals at or above this make a pro candidate, who needs a practical check. */
export const PRO_THRESHOLD = 14

export const INTERVIEW_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'absent', label: 'Absent' },
]

export const PRACTICAL_STATUSES = [
  { value: 'not_required', label: 'Not required' },
  { value: 'pending', label: 'Pending' },
  { value: 'passed', label: 'Passed' },
  { value: 'not_passed', label: 'Not passed' },
]

export const LEVELS = ['Beginner', 'Intermediate', 'Pro candidate']

export function blankAnswers() {
  return QUESTIONS.map(() => null)
}

/** Answers padded to one slot per question, so older rows still line up. */
export function answersOf(assessment) {
  const saved = assessment?.answers || []
  return QUESTIONS.map((_, i) => (Number.isInteger(saved[i]) ? saved[i] : null))
}

export const isComplete = answers => answers.every(v => v !== null)
export const scoreOf = answers => answers.reduce((n, v) => n + (v || 0), 0)

/** Level for a full set of answers; null while any question is unanswered. */
export function levelOf(answers) {
  if (!isComplete(answers)) return null
  const total = scoreOf(answers)
  return total <= 6 ? 'Beginner' : total < PRO_THRESHOLD ? 'Intermediate' : 'Pro candidate'
}

export const statusLabel = value => INTERVIEW_STATUSES.find(s => s.value === value)?.label || value
export const practicalLabel = value => PRACTICAL_STATUSES.find(s => s.value === value)?.label || value
