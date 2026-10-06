/**
 * Download an array of rows as a UTF-8 (BOM) CSV file that opens cleanly in Excel.
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    // Quote values containing commas, quotes or newlines
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }

  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Build a YYYY-MM-DD filename prefix (e.g. "2026-08-12"). */
export function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}
