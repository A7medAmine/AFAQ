import { read, supabase } from './db'

export const POLL_STATUSES = [
  { value: 'draft', label: 'Drafts' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
]

export const QUESTION_TYPES = [
  { value: 'single', label: 'One choice', hint: 'People pick one option.' },
  { value: 'multiple', label: 'Several choices', hint: 'People tick as many as allowed.' },
  { value: 'rating', label: 'Rating', hint: 'A score from 1 to 5 or 10.' },
  { value: 'text', label: 'Written answer', hint: 'A short free-text reply.' },
]

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
]

export const AUDIENCES = [
  { value: 'public', label: 'Anyone with the link', hint: 'One answer per device. Good for events and social media.' },
  { value: 'members', label: 'Club members only', hint: 'They enter their member code and email. One answer per member.' },
]

export const RESULTS_VISIBILITY = [
  { value: 'after_vote', label: 'After they answer' },
  { value: 'after_close', label: 'Once the poll closes' },
  { value: 'hidden', label: 'Never — admins only' },
]

export const IDENTITY = [
  { value: 'none', label: 'Anonymous', hint: 'No name or email asked.' },
  { value: 'optional', label: 'Optional', hint: 'Name and email fields they may skip.' },
  { value: 'required', label: 'Required', hint: 'Name and email must be filled in.' },
]

export const questionTypeLabel = type => QUESTION_TYPES.find(t => t.value === type)?.label || type

/** Short, unguessable link id: 10 characters from a 62-letter alphabet. */
export function newSlug(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}

export const pollUrl = (slug, source) =>
  `${window.location.origin}/p/${slug}${source ? `?src=${encodeURIComponent(source)}` : ''}`

/**
 * Where a poll stands right now. The saved status says what an admin chose;
 * the schedule and response cap can close it on their own.
 */
export function pollState(poll, responseCount = 0) {
  if (poll.status === 'draft') return 'draft'
  if (poll.status === 'closed') return 'closed'
  const now = Date.now()
  if (poll.closes_at && new Date(poll.closes_at).getTime() <= now) return 'closed'
  if (poll.opens_at && new Date(poll.opens_at).getTime() > now) return 'scheduled'
  if (poll.max_responses && responseCount >= poll.max_responses) return 'full'
  return 'open'
}

export const STATE_BADGE = {
  draft: { tone: 'wait', label: 'Draft' },
  scheduled: { tone: 'signal', label: 'Scheduled' },
  open: { tone: 'ok', label: 'Open' },
  full: { tone: 'neutral', label: 'Full' },
  closed: { tone: 'neutral', label: 'Closed' },
}

/** A fresh question of the given type, with starting options where it takes them. */
export function blankQuestion(type = 'single') {
  return {
    key: crypto.randomUUID(),
    type,
    prompt: '',
    help: '',
    required: true,
    min_choices: null,
    max_choices: null,
    scale_max: type === 'rating' ? 5 : null,
    options: type === 'single' || type === 'multiple' ? ['', ''] : [],
  }
}

/** Starting points offered when creating a poll. */
export const STARTERS = [
  { value: 'blank', label: 'Blank poll', questions: () => [blankQuestion('single')] },
  {
    value: 'yes_no',
    label: 'Yes / No question',
    questions: () => [{ ...blankQuestion('single'), options: ['Yes', 'No'] }],
  },
  {
    value: 'event_feedback',
    label: 'Event feedback',
    questions: () => [
      { ...blankQuestion('rating'), prompt: 'How would you rate the event overall?' },
      { ...blankQuestion('single'), prompt: 'Would you come to another event like this?', options: ['Yes', 'Maybe', 'No'] },
      { ...blankQuestion('text'), prompt: 'What could we do better?', required: false },
    ],
  },
  {
    value: 'pick_date',
    label: 'Pick a date',
    questions: () => [
      { ...blankQuestion('multiple'), prompt: 'Which days work for you?', help: 'Tick every day you could come.', options: ['', '', ''] },
    ],
  },
]

/** Questions as the editor holds them, from the saved rows. */
export function toEditable(questions) {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .map(q => ({
      key: String(q.id),
      type: q.type,
      prompt: q.prompt,
      help: q.help || '',
      required: q.required,
      min_choices: q.min_choices,
      max_choices: q.max_choices,
      scale_max: q.scale_max,
      options: [...(q.options || [])].sort((a, b) => a.position - b.position).map(o => o.label),
    }))
}

/**
 * Check the editor's questions before saving. Returns `{ errors }` keyed by
 * question key, or `{ payload }` ready for poll_replace_questions.
 */
export function prepareQuestions(questions) {
  const errors = {}
  const payload = questions.map(q => {
    const options = q.options.map(o => o.trim()).filter(Boolean)
    const choice = q.type === 'single' || q.type === 'multiple'
    if (!q.prompt.trim()) errors[q.key] = 'Write the question.'
    else if (choice && options.length < 2) errors[q.key] = 'Give at least two options.'
    else if (choice && new Set(options.map(o => o.toLowerCase())).size !== options.length) errors[q.key] = 'Two options say the same thing.'
    else if (q.type === 'multiple' && q.min_choices && q.max_choices && q.min_choices > q.max_choices) errors[q.key] = 'The minimum is above the maximum.'
    else if (q.type === 'multiple' && q.max_choices && q.max_choices > options.length) errors[q.key] = `There are only ${options.length} options to pick from.`
    return {
      type: q.type,
      prompt: q.prompt.trim(),
      help: q.help.trim() || null,
      required: !!q.required,
      min_choices: q.type === 'multiple' ? q.min_choices || null : null,
      max_choices: q.type === 'multiple' ? q.max_choices || null : null,
      scale_max: q.type === 'rating' ? q.scale_max || 5 : null,
      options: choice ? options : [],
    }
  })
  if (!questions.length) return { errors: { _poll: 'Add at least one question.' } }
  return Object.keys(errors).length ? { errors } : { payload }
}

/** Every row of a query, past PostgREST's 1000-row page. */
async function readAll(build) {
  const rows = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const res = await read(build().range(from, from + size - 1))
    if (!res.ok) return res
    rows.push(...res.data)
    if (res.data.length < size) return { ok: true, data: rows }
  }
}

export async function loadResponses(pollId) {
  const [responses, answers] = await Promise.all([
    readAll(() => supabase.from('poll_responses').select('id, name, email, source, member_id, created_at').eq('poll_id', pollId).order('created_at')),
    readAll(() => supabase.from('poll_answers').select('response_id, question_id, option_id, number_value, text_value').eq('poll_id', pollId).order('id')),
  ])
  if (!responses.ok) return responses
  if (!answers.ok) return answers
  return { ok: true, responses: responses.data, answers: answers.data }
}

/** Per-question totals for the results tab, written answers included. */
export function tally(questions, responses, answers) {
  const byQuestion = new Map(questions.map(q => [q.id, []]))
  for (const a of answers) byQuestion.get(a.question_id)?.push(a)
  const when = new Map(responses.map(r => [r.id, r.created_at]))

  return questions.map(q => {
    const rows = byQuestion.get(q.id) || []
    const answered = new Set(rows.map(r => r.response_id)).size
    if (q.type === 'rating') {
      const scale = q.scale_max || 5
      const values = rows.map(r => r.number_value).filter(Number.isInteger)
      return {
        question: q,
        answered,
        average: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
        counts: Array.from({ length: scale }, (_, i) => ({ label: String(i + 1), count: values.filter(v => v === i + 1).length })),
      }
    }
    if (q.type === 'text') {
      return {
        question: q,
        answered,
        texts: rows.filter(r => r.text_value).map(r => ({ text: r.text_value, at: when.get(r.response_id) }))
          .sort((a, b) => String(b.at).localeCompare(String(a.at))),
      }
    }
    const options = [...(q.options || [])].sort((a, b) => a.position - b.position)
    return {
      question: q,
      answered,
      counts: options.map(o => ({ id: o.id, label: o.label, count: rows.filter(r => r.option_id === o.id).length })),
    }
  })
}

/** One row per response for CSV/PDF export: when, who, then each answer. */
export function exportTable(questions, responses, answers) {
  const optionLabel = new Map(questions.flatMap(q => (q.options || []).map(o => [o.id, o.label])))
  const byResponse = new Map(responses.map(r => [r.id, new Map()]))
  for (const a of answers) {
    const cells = byResponse.get(a.response_id)
    if (!cells) continue
    const value = a.option_id ? optionLabel.get(a.option_id) : a.number_value ?? a.text_value
    const prev = cells.get(a.question_id)
    cells.set(a.question_id, prev ? `${prev}; ${value}` : String(value ?? ''))
  }
  const ordered = [...questions].sort((a, b) => a.position - b.position)
  return {
    headers: ['Submitted', 'Name', 'Email', 'Source', ...ordered.map((q, i) => `Q${i + 1}. ${q.prompt}`)],
    rows: responses.map(r => {
      const cells = byResponse.get(r.id)
      return [new Date(r.created_at).toLocaleString(), r.name || '', r.email || '', r.source || '', ...ordered.map(q => cells.get(q.id) || '')]
    }),
  }
}

/** A copy of a poll as a new draft, questions included, with a new link. */
export async function duplicatePoll(poll, questions, userId) {
  const { id: _id, slug: _slug, created_at: _c, updated_at: _u, questions: _q, responses: _r, ...rest } = poll
  const insert = await read(
    supabase.from('polls').insert({ ...rest, title: `${poll.title} (copy)`, slug: newSlug(), status: 'draft', created_by: userId }).select('id').single()
  )
  if (!insert.ok) return insert
  const copy = await read(supabase.rpc('poll_replace_questions', { p_poll_id: insert.data.id, p_questions: prepareQuestions(toEditable(questions)).payload || [] }))
  if (!copy.ok) return copy
  return { ok: true, id: insert.data.id }
}
