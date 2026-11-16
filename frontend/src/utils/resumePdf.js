// hanapbuhay Resume Builder: PDF writer (no libraries).
//
// The PDF uses the built-in Helvetica fonts and uncompressed text, so any PDF
// reader shows it and the backend can read the text back. The full resume data
// is also embedded (base64 JSON after "HBR1:" in the document info), which lets
// Smart Auto-Fill (backend/app/libraries/Resume_parser.php → read_embedded)
// fill every profile field and skill exactly.

const PAGE_W = 595.28 // A4 in points
const PAGE_H = 841.89
const MARGIN = 46
const CONTENT_W = PAGE_W - MARGIN * 2

// Advance widths (1/1000 em) for ASCII 32–126
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584]
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584]

// Unicode → WinAnsi byte for characters outside Latin-1 that Filipino resumes use
const WIN_ANSI = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 }

export const THEMES = {
  navy:   { label: 'Navy',   rgb: [13, 27, 62],  accent: [245, 166, 35] },
  teal:   { label: 'Teal',   rgb: [17, 94, 89],  accent: [250, 204, 21] },
  maroon: { label: 'Maroon', rgb: [127, 29, 29], accent: [251, 191, 36] },
}

export const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' }

/** Text → WinAnsi byte codes (unknown characters become '?', the peso sign becomes "PHP "). */
function toBytes(str) {
  const out = []
  for (const ch of String(str ?? '').replace(/₱\s?/g, 'PHP ').normalize('NFC')) {
    const c = ch.codePointAt(0)
    if (c === 9) out.push(32)
    else if (c >= 32 && c <= 126) out.push(c)
    else if (c >= 0xA0 && c <= 0xFF) out.push(c)
    else if (WIN_ANSI[ch]) out.push(WIN_ANSI[ch])
    else if (c > 32) out.push(63)
  }
  return out
}

function widthOf(str, bold, size) {
  const table = bold ? HELV_B : HELV
  let w = 0
  for (const b of toBytes(str)) w += (b >= 32 && b <= 126 ? table[b - 32] : 556)
  return (w * size) / 1000
}

/** PDF literal string, ASCII only: escapes ( ) \ and writes other bytes as octal. */
function pdfStr(str) {
  let s = '('
  for (const b of toBytes(str)) {
    if (b === 40 || b === 41 || b === 92) s += '\\' + String.fromCharCode(b)
    else if (b < 32 || b > 126) s += '\\' + b.toString(8).padStart(3, '0')
    else s += String.fromCharCode(b)
  }
  return s + ')'
}

function wrap(text, bold, size, maxW) {
  const lines = []
  for (const para of String(text ?? '').split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) { lines.push(''); continue }
    let line = ''
    for (let word of words) {
      // a single word wider than the line (long URL/email): hard-break it
      while (widthOf(word, bold, size) > maxW) {
        let cut = word.length - 1
        while (cut > 1 && widthOf(word.slice(0, cut), bold, size) > maxW) cut--
        if (line) { lines.push(line); line = '' }
        lines.push(word.slice(0, cut))
        word = word.slice(cut)
      }
      const next = line ? line + ' ' + word : word
      if (widthOf(next, bold, size) <= maxW) line = next
      else { lines.push(line); line = word }
    }
    if (line) lines.push(line)
  }
  return lines
}

const rgb = ([r, g, b]) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`
const num = n => (Math.round(n * 100) / 100).toString()

function base64Utf8(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Square JPEG of the profile photo, or null if it can't be read (e.g. a cross-origin URL). */
export async function photoToJpeg(src, px = 300) {
  if (!src) return null
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = src
    })
    const c = document.createElement('canvas')
    c.width = c.height = px
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, px, px)
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, px, px)
    const dataUrl = c.toDataURL('image/jpeg', 0.88)
    const bin = atob(dataUrl.split(',')[1])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { bytes, px }
  } catch {
    return null
  }
}

/** Fields Smart Auto-Fill needs; returns the missing ones (labels). */
export function missingForAutofill(r) {
  const miss = []
  if (!r.full_name?.trim()) miss.push('Full name')
  if (!/^(\+?63|0)9\d{9}$/.test((r.phone || '').replace(/[\s-]/g, ''))) miss.push('Mobile number (09XXXXXXXXX)')
  if (!r.town) miss.push('Town')
  if (!r.about?.trim()) miss.push('About me / objective')
  if (!(r.skills || []).some(s => s.name?.trim())) miss.push('At least one skill')
  return miss
}

/** The data embedded in the PDF for Smart Auto-Fill (same keys Resume_parser::read_embedded reads). */
function embeddedData(r) {
  const clean = rows => (rows || []).filter(x => Object.values(x).some(v => String(v ?? '').trim()))
  return {
    v: 1,
    full_name: r.full_name || '', email: r.email || '', phone: (r.phone || '').replace(/[\s-]/g, ''),
    town: r.town || '', address: r.address || '', about: r.about || '',
    birthdate: r.birthdate || '', languages: r.languages || '',
    skills: clean(r.skills), certifications: clean(r.certifications),
    experience: clean(r.experience), education: clean(r.education),
  }
}

/**
 * Builds the resume PDF.
 * @param {object} r      resume draft (see ResumeBuilder.jsx)
 * @param {object} [opt]  { photo: {bytes, px} | null }
 * @returns {Blob}
 */
export function buildResumePdf(r, { photo = null } = {}) {
  const theme = THEMES[r.theme] || THEMES.navy
  const pages = []
  let ops = null
  let y = 0 // distance from the top of the page

  const newPage = () => { ops = []; pages.push(ops); y = MARGIN }
  const text = (x, top, str, { bold = false, size = 10, color = [55, 65, 81] } = {}) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${num(x)} ${num(PAGE_H - top - size)} Td ${pdfStr(str)} Tj ET`)
  }
  const rect = (x, top, w, h, color) => ops.push(`${rgb(color)} rg ${num(x)} ${num(PAGE_H - top - h)} ${num(w)} ${num(h)} re f`)
  const ensure = h => { if (y + h > PAGE_H - MARGIN - 14) newPage() }
  const para = (str, { size = 10, bold = false, color, x = MARGIN, w = CONTENT_W, lead = 1.45 } = {}) => {
    for (const line of wrap(str, bold, size, w)) {
      ensure(size * lead)
      if (line) text(x, y, line, { size, bold, color })
      y += size * lead
    }
  }
  const heading = label => {
    ensure(40)
    y += 10
    text(MARGIN, y, label.toUpperCase(), { bold: true, size: 10.5, color: theme.rgb })
    y += 15
    rect(MARGIN, y, CONTENT_W, 1.2, theme.rgb)
    rect(MARGIN, y, 46, 2.4, theme.accent)
    y += 10
  }

  newPage()

  // ── Header band ───────────────────────────────────────────
  const town = r.town ? `${r.town}, Oriental Mindoro` : ''
  const address = [r.address, town].filter(Boolean).join(', ')
  const contact = [
    r.phone && `Phone: ${r.phone}`,
    r.email && `Email: ${r.email}`,
  ].filter(Boolean)
  const photoSize = photo ? 92 : 0
  const textW = CONTENT_W - (photo ? photoSize + 18 : 0)
  const nameLines = wrap(r.full_name || 'Your Name', true, 24, textW)
  const addrLines = address ? wrap(`Address: ${address}`, false, 9.5, textW) : []
  const bandH = Math.max(photoSize + 36, 34 + nameLines.length * 28 + (contact.length ? 16 : 0) + addrLines.length * 14 + 14)
  rect(0, 0, PAGE_W, bandH, theme.rgb)
  rect(0, bandH, PAGE_W, 4, theme.accent)

  let hy = 26
  for (const l of nameLines) { text(MARGIN, hy, l, { bold: true, size: 24, color: [255, 255, 255] }); hy += 28 }
  if (contact.length) { text(MARGIN, hy + 2, contact.join('   |   '), { size: 9.5, color: [226, 232, 240] }); hy += 16 }
  for (const l of addrLines) { text(MARGIN, hy + 2, l, { size: 9.5, color: [226, 232, 240] }); hy += 14 }
  if (photo) {
    const px = PAGE_W - MARGIN - photoSize
    rect(px - 3, 15, photoSize + 6, photoSize + 6, [255, 255, 255])
    ops.push(`q ${photoSize} 0 0 ${photoSize} ${num(px)} ${num(PAGE_H - 18 - photoSize)} cm /Im1 Do Q`)
  }
  y = bandH + 18

  // ── Sections ───────────────────────────────────────────────
  if (r.about?.trim()) {
    heading('About Me')
    para(r.about.trim(), { size: 10 })
  }

  const skills = (r.skills || []).filter(s => s.name?.trim())
  if (skills.length) {
    heading('Skills')
    const colW = (CONTENT_W - 16) / 2
    for (let i = 0; i < skills.length; i += 2) {
      ensure(16)
      for (const [j, s] of [skills[i], skills[i + 1]].entries()) {
        if (!s) continue
        const x = MARGIN + j * (colW + 16)
        const lvl = LEVEL_LABEL[s.level] ? ` (${LEVEL_LABEL[s.level]})` : ''
        rect(x, y + 4, 4, 4, theme.accent)
        text(x + 10, y, wrap(s.name.trim() + lvl, false, 10, colW - 12)[0] || '', { size: 10, color: [31, 41, 55] })
      }
      y += 16
    }
  }

  const certs = (r.certifications || []).filter(c => c.title?.trim())
  if (certs.length) {
    heading('Certifications & Trainings')
    for (const c of certs) {
      ensure(30)
      text(MARGIN, y, c.title.trim(), { bold: true, size: 10.5, color: [17, 24, 39] })
      if (c.year) text(PAGE_W - MARGIN - widthOf(c.year, false, 9.5), y + 1, c.year, { size: 9.5, color: [107, 114, 128] })
      y += 14
      const meta = [c.issuer, c.number && `Certificate No. ${c.number}`].filter(Boolean).join('  ·  ')
      if (meta) para(meta, { size: 9.5, color: [75, 85, 99], lead: 1.35 })
      y += 5
    }
  }

  const exp = (r.experience || []).filter(e => e.position?.trim() || e.employer?.trim())
  if (exp.length) {
    heading('Work Experience')
    for (const e of exp) {
      ensure(34)
      const dates = [e.start, e.end || (e.start ? 'Present' : '')].filter(Boolean).join(' – ')
      const dw = dates ? widthOf(dates, false, 9.5) + 12 : 0
      if (dates) text(PAGE_W - MARGIN - widthOf(dates, false, 9.5), y + 1, dates, { size: 9.5, color: [107, 114, 128] })
      for (const l of wrap(e.position || e.employer, true, 10.5, CONTENT_W - dw)) { ensure(14); text(MARGIN, y, l, { bold: true, size: 10.5, color: [17, 24, 39] }); y += 14 }
      const where = [e.position ? e.employer : '', e.place].filter(Boolean).join(', ')
      if (where) para(where, { size: 9.5, color: theme.rgb, lead: 1.35 })
      if (e.details?.trim()) { y += 2; para(e.details.trim(), { size: 9.5, lead: 1.4 }) }
      y += 7
    }
  }

  const edu = (r.education || []).filter(e => e.school?.trim())
  if (edu.length) {
    heading('Education')
    for (const e of edu) {
      ensure(30)
      const yw = e.year ? widthOf(e.year, false, 9.5) + 12 : 0
      if (e.year) text(PAGE_W - MARGIN - widthOf(e.year, false, 9.5), y + 1, e.year, { size: 9.5, color: [107, 114, 128] })
      for (const l of wrap(e.school, true, 10.5, CONTENT_W - yw)) { ensure(14); text(MARGIN, y, l, { bold: true, size: 10.5, color: [17, 24, 39] }); y += 14 }
      if (e.level) para(e.level, { size: 9.5, color: [75, 85, 99], lead: 1.35 })
      y += 6
    }
  }

  const personal = [
    r.birthdate && ['Date of Birth', r.birthdate],
    r.languages && ['Languages', r.languages],
    r.town && ['Town', `${r.town}, Oriental Mindoro`],
  ].filter(Boolean)
  if (personal.length) {
    ensure(40 + personal.length * 15) // keep this short block on one page
    heading('Personal Information')
    for (const [k, v] of personal) {
      ensure(15)
      text(MARGIN, y, `${k}:`, { bold: true, size: 9.5, color: [31, 41, 55] })
      const lines = wrap(v, false, 9.5, CONTENT_W - 100)
      lines.forEach((l, i) => { if (i) ensure(14); text(MARGIN + 100, y, l, { size: 9.5 }); y += 14 })
    }
  }

  // Footer on every page
  pages.forEach((p, i) => {
    const label = `Created with hanapbuhay Resume Builder${pages.length > 1 ? `  ·  Page ${i + 1} of ${pages.length}` : ''}`
    p.push(`BT /F1 7.5 Tf ${rgb([156, 163, 175])} rg ${num(MARGIN)} 22 Td ${pdfStr(label)} Tj ET`)
  })

  // ── Assemble the file ─────────────────────────────────────
  const parts = []
  const offsets = []
  let length = 0
  const push = chunk => { parts.push(chunk); length += typeof chunk === 'string' ? chunk.length : chunk.byteLength }
  const obj = (id, body) => { offsets[id] = length; push(`${id} 0 obj\n`); body(); push('\nendobj\n') }

  push('%PDF-1.4\n%âãÏÓ\n'.replace(/[^\x00-\x7F]/g, '~'))

  const FIRST_PAGE_ID = photo ? 6 : 5
  const pageIds = pages.map((_, i) => FIRST_PAGE_ID + i * 2)
  const infoId = FIRST_PAGE_ID + pages.length * 2

  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'))
  obj(2, () => push(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`))
  obj(3, () => push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'))
  obj(4, () => push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'))
  if (photo) {
    obj(5, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${photo.px} /Height ${photo.px} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${photo.bytes.byteLength} >>\nstream\n`)
      push(photo.bytes)
      push('\nendstream')
    })
  }
  pages.forEach((p, i) => {
    const content = p.join('\n')
    const xobj = photo && i === 0 ? ' /XObject << /Im1 5 0 R >>' : ''
    obj(pageIds[i], () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobj} >> /Contents ${pageIds[i] + 1} 0 R >>`))
    obj(pageIds[i] + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
  })
  const payload = 'HBR1:' + base64Utf8(JSON.stringify(embeddedData(r)))
  obj(infoId, () => push(`<< /Title ${pdfStr(`${r.full_name || 'Resume'} - Resume`)} /Author ${pdfStr(r.full_name || '')} /Producer (hanapbuhay Resume Builder) /Subject (hanapbuhay Resume) /HBResume (${payload}) >>`))

  const xrefAt = length
  let xref = `xref\n0 ${infoId + 1}\n0000000000 65535 f \n`
  for (let id = 1; id <= infoId; id++) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  push(xref)
  push(`trailer\n<< /Size ${infoId + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  return new Blob(parts, { type: 'application/pdf' })
}

export function resumeFileName(r) {
  const n = (r.full_name || 'My').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `Resume-${n || 'hanapbuhay'}.pdf`
}
