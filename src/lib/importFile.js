import readXlsxFile from 'read-excel-file/browser'

// Parse a CSV or Excel file of birthdays. Files need two columns: a name and a
// date. Header names are auto-detected; if there's no recognizable header we
// assume column 1 = name, column 2 = date.

const NAME_KEYS = ['full name', 'name', 'full_name', 'fullname', 'employee', 'staff', 'person']
const DATE_KEYS = ['birthday', 'birth date', 'birthdate', 'birth_date', 'dob', 'date of birth', 'bday', 'date']

const pad = (n) => String(n).padStart(2, '0')
const norm = (h) => String(h ?? '').trim().toLowerCase()

// Normalize any cell to 'YYYY-MM-DD', or null if it can't be understood.
// Ambiguous d/m vs m/d defaults to DAY-first (Australian convention).
export function toISODate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date && !isNaN(value)) {
    // read-excel-file gives date cells as UTC-midnight Dates → read them in UTC
    // so the calendar day is stable regardless of the browser's timezone.
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  }
  const s = String(value).trim()

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) // ISO
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/) // d/m/y or m/d/y
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3]
    if (y < 100) y += y <= 30 ? 2000 : 1900
    let day, mo
    if (a > 12) { day = a; mo = b }        // a can only be a day
    else if (b > 12) { day = b; mo = a }   // b can only be a day (US m/d)
    else { day = a; mo = b }               // ambiguous → day-first (AU)
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) return `${y}-${pad(mo)}-${pad(day)}`
  }

  const t = Date.parse(s) // "12 August 1990", "August 12, 1990", etc.
  if (!isNaN(t)) {
    const d = new Date(t)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return null
}

function splitCSVLine(line) {
  const out = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function parseCSV(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length).map(splitCSVLine)
}

// → { valid: [{full_name, birth_date}], invalid: [{full_name, raw}] }
export async function parseBirthdayFile(file) {
  const lower = file.name.toLowerCase()
  let rows
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    rows = parseCSV(await file.text())
  } else {
    rows = await readXlsxFile(file) // array of arrays; date cells come back as Date objects
  }
  if (!rows || rows.length === 0) return { valid: [], invalid: [], error: 'The file appears to be empty.' }

  const header = rows[0].map(norm)
  let nameIdx = header.findIndex((h) => NAME_KEYS.includes(h))
  let dateIdx = header.findIndex((h) => DATE_KEYS.some((k) => h.includes(k)))
  let dataRows = rows.slice(1)

  if (nameIdx === -1 || dateIdx === -1) {
    // No recognizable header → assume col 0 = name, col 1 = date, treat all rows as data.
    nameIdx = 0
    dateIdx = 1
    dataRows = rows
  }

  const valid = [], invalid = []
  for (const r of dataRows) {
    const full_name = String(r[nameIdx] ?? '').trim()
    const rawDate = r[dateIdx]
    if (!full_name && (rawDate == null || rawDate === '')) continue // blank line
    const iso = toISODate(rawDate)
    if (full_name && iso) valid.push({ full_name, birth_date: iso })
    else invalid.push({ full_name: full_name || '(no name)', raw: rawDate instanceof Date ? rawDate.toDateString() : String(rawDate ?? '') })
  }
  return { valid, invalid }
}

export const TEMPLATE_CSV = 'Full Name,Birthday\nJane Dela Cruz,1990-08-12\nJohn Smith,15/03/1985\n'

export function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'birthday-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
