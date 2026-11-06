import { slugify } from '../../components/markdown/plugins'

export { slugify }

export const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export const RESOURCE_KINDS = [
  { value: 'link', label: 'Link' },
  { value: 'code', label: 'Code / repo' },
  { value: 'slides', label: 'Slides' },
  { value: 'download', label: 'Download' },
  { value: 'video', label: 'Video' },
  { value: 'doc', label: 'Docs' },
]

export function guessKind(url = '') {
  const u = url.toLowerCase()
  if (/github\.com|gitlab\.com|wokwi\.com|replit\.com|codepen\.io/.test(u)) return 'code'
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(u)) return 'video'
  if (/docs\.google\.com\/presentation|canva\.com|\.pptx?(\?|$)|slides/.test(u)) return 'slides'
  if (/\.(zip|rar|7z|pdf|ino|hex|stl)(\?|$)|drive\.google\.com|dropbox\.com/.test(u)) return 'download'
  if (/docs\.|readthedocs|developer\.|\/docs?\//.test(u)) return 'doc'
  return 'link'
}

export const isHttpUrl = value => /^https?:\/\/\S+$/i.test(String(value || '').trim())

const line = (label, value, fallback) => `- ${label}: ${value ? value : fallback}`

/**
 * The prompt a manager copies into any AI chat. The answer comes back as one
 * Markdown document with a front-matter block, which the editor reads on
 * paste to fill in the title, summary, level, tags, needs and resources.
 */
export function buildAiPrompt({ form, event, project, notes }) {
  const requirements = (form.requirements || '').split('\n').map(s => s.trim()).filter(Boolean)
  const resources = (form.resources || []).filter(r => r.url)
  const eventLine = event
    ? `${event.title_en}${event.date ? `, ${event.date}` : ''}${event.time ? ` at ${String(event.time).slice(0, 5)}` : ''}${event.location_en ? `, ${event.location_en}` : ''}`
    : null

  const parts = []
  parts.push(`You are helping AFAQ Scientific Club, a university club for electronics, robotics, programming and science, write a tutorial for the "Learn" section of its website. Members and visitors follow it during and after our workshops, so it must be accurate, practical and easy to follow step by step.`)

  parts.push(`## What the tutorial is about
${line('Topic / working title', form.title?.trim(), '[describe the topic]')}
${line('Workshop', eventLine, 'none, this is a standalone tutorial')}
${line('Audience level', form.level, 'beginner')}
${line('Summary / what people build or learn', form.summary?.trim(), '[fill in from the details below]')}
${line('Tags', (form.tags || []).join(', '), '[suggest 2 to 5]')}
${line('What attendees need', requirements.join('; '), '[work it out from the details below]')}
${resources.length ? `- Links we already have (use these, do not invent others):\n${resources.map(r => `  - ${r.label || r.url}: ${r.url}`).join('\n')}` : '- Links we already have: none yet'}`)

  if (project) {
    const tech = (project.technologies || []).join(', ')
    parts.push(`## The club project this is based on
- Name: ${project.title_en}
${project.category ? `- Category: ${project.category}\n` : ''}${tech ? `- Built with: ${tech}\n` : ''}${project.github_url ? `- Repository: ${project.github_url}\n` : ''}${project.demo_url ? `- Demo: ${project.demo_url}\n` : ''}${project.description_en ? `- Description: ${project.description_en}\n` : ''}${project.content_en ? `\nProject write-up:\n"""\n${project.content_en.trim()}\n"""` : ''}`.trimEnd())
  }

  parts.push(`## Details from the organiser
${notes?.trim() ? `"""\n${notes.trim()}\n"""` : '[Paste here: the plan of the workshop, the code you will use, wiring, photos to describe, links, anything the tutorial should cover.]'}`)

  if (form.content?.trim()) {
    parts.push(`## Current draft
Improve and complete this draft. Keep what is correct, fix what is wrong, fill the gaps.
"""
${form.content.trim()}
"""`)
  }

  parts.push(`## How to answer (follow exactly, the answer is pasted straight into our editor)
Reply with ONE Markdown document and nothing else: no greeting, no explanation before or after, and do not wrap the whole answer in a code block.

Start with this front-matter block, filled in:

---
title: Short, clear title (under 70 characters)
summary: One or two sentences saying what the reader will build or learn (under 200 characters)
level: beginner | intermediate | advanced
tags: arduino, sensors, c++
requirements:
  - Laptop with Arduino IDE 2 installed
  - USB cable
resources:
  - label: Starter code
    url: https://github.com/...
---

Then the tutorial body:
- Use ## for main sections and ### for steps inside them. Never use a single # (the page already shows the title).
- Suggested outline: a short intro (what we build and why), "What you need", "Before the workshop" if anything must be installed first, numbered step sections (### Step 1: ...), "Troubleshooting", "Going further".
- Code goes in fenced blocks with the language, plus a file name when it is a file, for example:
  \`\`\`cpp title="blink.ino"
  Languages: bash, python, javascript, cpp (also for Arduino), c, html, css, json, yaml, sql.
- Terminal commands go in \`\`\`bash blocks, one command per line, without a "$" prompt, so they can be copied as is.
- Complete, working code only. No "..." in the middle of code people are meant to copy.
- Callouts: a line "> [!NOTE]", "> [!TIP]", "> [!WARNING]" or "> [!IMPORTANT]", then the text on following lines that also start with ">".
- Checklists: "- [ ] item".
- Links: [text](https://full-url). Never invent a URL; where a link is needed and you do not know it, write [TODO: link to ...].
- Images: write ![what the image shows](TODO) where a photo, wiring diagram or screenshot would help; we upload them later.
- A YouTube URL alone on its own line becomes an embedded video.
- Tables: GitHub-style Markdown tables.
- No HTML tags.
- Write in clear, friendly English for ${form.level || 'beginner'} university students. Short paragraphs. Explain why, not only what.`)

  return parts.join('\n\n')
}

/** AI chats often wrap the whole answer in ```markdown … ```. */
function unwrapFence(text) {
  const m = text.match(/^\s*```(?:markdown|md)?[ \t]*\n([\s\S]*?)\n```\s*$/i)
  return m ? m[1] : text
}

const unquote = v => v.trim().replace(/^(["'])(.*)\1$/, '$2').trim()

/** Reads the small YAML subset the prompt asks for. Unknown keys are ignored. */
function parseFrontMatter(block) {
  const meta = {}
  let listKey = null
  let current = null
  for (const raw of block.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    const top = raw.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (top) {
      const [, key, value] = top
      current = null
      if (value.trim()) { meta[key.toLowerCase()] = unquote(value); listKey = null }
      else { listKey = key.toLowerCase(); meta[listKey] = [] }
      continue
    }
    if (!listKey) continue
    const item = raw.match(/^\s*-\s*(.*)$/)
    const field = raw.match(/^\s+([A-Za-z_]+):\s*(.*)$/)
    if (item) {
      const inner = item[1].match(/^([A-Za-z_]+):\s*(.*)$/)
      if (inner && !isHttpUrl(item[1])) {
        current = { [inner[1].toLowerCase()]: unquote(inner[2]) }
        meta[listKey].push(current)
      } else {
        current = null
        if (item[1].trim()) meta[listKey].push(unquote(item[1]))
      }
    } else if (field && current) {
      current[field[1].toLowerCase()] = unquote(field[2])
    }
  }
  return meta
}

/**
 * Splits a pasted AI answer into fields and body. Returns null when the text
 * has no front matter, so ordinary pastes stay ordinary.
 */
export function parseAiAnswer(text) {
  const clean = unwrapFence(String(text || '').replace(/\r\n/g, '\n'))
  const m = clean.match(/^\s*---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/)
  if (!m) return null
  const meta = parseFrontMatter(m[1])
  if (!meta.title && !meta.summary && !meta.tags) return null

  const level = String(meta.level || '').toLowerCase()
  const tags = Array.isArray(meta.tags) ? meta.tags : String(meta.tags || '').split(',')
  const requirements = Array.isArray(meta.requirements)
    ? meta.requirements.filter(r => typeof r === 'string')
    : meta.requirements ? [meta.requirements] : []
  const resources = (Array.isArray(meta.resources) ? meta.resources : [])
    .map(r => (typeof r === 'string' ? { url: r } : r))
    .filter(r => isHttpUrl(r.url))
    .map(r => ({ label: r.label || r.title || r.url, url: r.url.trim(), kind: guessKind(r.url) }))

  // Drop a leading "# Title" — the page prints the title itself.
  const body = m[2].replace(/^\s*#\s+[^\n]*\n+/, '').trim()

  return {
    title: meta.title || '',
    summary: meta.summary || '',
    level: LEVELS.some(l => l.value === level) ? level : '',
    tags: tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 8),
    requirements,
    resources,
    body,
  }
}
