 // Normalize the admin roll-number field block + convert the "Suggested" hint
// into a live "Roll number used" / "Suggested" conditional.
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const p = join(__dirname, '..', 'src/app/admin/students/page.tsx')
let s = readFileSync(p, 'utf8')

// 1) Normalize any over-indented onChange line for the rollNumber input.
s = s.replace(
  /^[ \t]*onChange=\{ ?\(e\) => setRollNumber\(e\.target\.value\)\}\s*$/m,
  '                  onChange={(e) => setRollNumber(e.target.value)}'
)

// 2) Replace the static "Suggested" <p> with a rollTaken-aware hint.
s = s.replace(
  /<p className="text-xs text-gray-400">\n[ \t]*Suggested: \{autoRoll\}[^\n]*\n[ \t]*<\/p>/,
  '{rollTaken ? (\n                  <p className="text-xs font-medium text-red-600">Roll number used</p>\n                ) : (\n                  <p className="text-xs text-gray-400">\n                    Suggested: {effectiveRoll === autoRoll ? autoRoll : effectiveRoll} \u2014 you can edit this to rearrange roll numbers.\n                  </p>\n                )}'
)

// 3) Make the success message report the roll that was actually assigned.
s = s.replace(
  /Student added successfully with Roll No \$\{autoRoll\}/,
  () => 'Student added successfully with Roll No ${effectiveRoll}'
)

writeFileSync(p, s)
console.log('admin roll-field region normalized')
