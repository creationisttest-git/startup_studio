#!/usr/bin/env node
'use strict'

/**
 * make-outline.js
 *
 * GIVE AN AGENT A MAP OF A LARGE FILE SO IT READS TWO HUNDRED LINES INSTEAD OF FIFTEEN THOUSAND.
 *
 * WHY THIS EXISTS AND NOT A FILE SPLITTER. The founder asked on 2026-09-17 for code to be written
 * as small files to pull from, and the first instinct was to partition the largest file in a sibling project,
 * a console main.js at 873,860 bytes and 15,486 lines. Two things stopped that.
 *
 * FIRST, THE FILE CANNOT BE PARTITIONED THE WAY ITS OWN HEADER SAYS IT WAS. That header records an
 * earlier move out of an 835 KB HTML file and argues the move was safe because the blocks were
 * never IIFEs, so separate script files share one global scope in document order. True then. The
 * RESULT is a single IIFE: every var and function in those 15,486 lines lives in one closure.
 * Cutting it into script tags makes all of them global at once, which is a behaviour change wearing
 * the costume of a file move, and nothing here can run that project's tests to catch it.
 *
 * SECOND, THIS PROJECT HAD ALREADY WRITTEN DOWN WHY SPLITTING FIRST IS THE WRONG ORDER. On ST-258:
 * splitting files before a read rule exists can RAISE cost, because an agent that reads whole files
 * will read five modules where it read one. The same ordering error the founder's original token
 * proposal had, and it was recorded here before being repeated.
 *
 * SO THE CHEAP WIN IS THE PRECONDITION RATHER THAN THE SPLIT. An outline turns a 218,000-token
 * whole-file read into a listing plus a narrow read of the one range that matters. It is also what
 * makes a later split pay rather than backfire, because an agent that can find the right range
 * stops pulling whole files in the first place.
 *
 * WHAT IT DOES NOT DO. It does not parse. A parser for four languages is a liability that goes
 * stale against every syntax it has not seen, and the job here is navigation rather than analysis:
 * a line number that is roughly right saves the read, and a line number that is wrong costs one
 * more grep. It reads structure from indentation, declaration keywords and banner comments.
 *
 * usage: node make-outline.js <file> [<file>...] [--out <path>] [--min-lines <n>] [--quiet]
 */

const fs = require('fs')
const path = require('path')

// A line that introduces something worth jumping to. Ordered by how much it tells a reader, and
// deliberately loose: a false entry costs one line of the outline, a missed one costs a whole read.
const MARKS = [
  { kind: 'banner', re: /^\s*(?:\/\*|\/\/|#|<!--)\s*[=\-─═*]{6,}/ },
  { kind: 'class', re: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'func', re: /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/ },
  { kind: 'func', re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/ },
  { kind: 'func', re: /^\s*(?:public|private|protected|static|\s)*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/ },
  { kind: 'def', re: /^\s*(?:async\s+)?def\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'func', re: /^\s*function\s+([A-Za-z_$][\w$-]*)\s*\{/ },
  { kind: 'sql', re: /^\s*(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|FUNCTION|POLICY|INDEX|TRIGGER|TYPE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([\w."]+)/i },
  { kind: 'head', re: /^\s*(?:\/\/|#|\/\*)\s*([A-Z][A-Z0-9 ,'\-]{9,})/ },
]

// A banner comment says what a section IS, and the line after it usually says it better than the
// row of equals signs does. This pulls the first line with actual words in it.
function bannerTitle (lines, i) {
  for (let j = i; j < Math.min(i + 4, lines.length); j++) {
    const t = lines[j].replace(/^\s*(?:\/\*+|\/\/+|#+|<!--)?\s*/, '').replace(/[=\-─═*]{4,}/g, '').trim()
    if (t.length > 3 && /[A-Za-z]/.test(t)) return t
  }
  return ''
}

function outlineOf (file, minLines) {
  const raw = fs.readFileSync(file, 'utf8')
  const lines = raw.split(/\r?\n/)
  if (lines.length < minLines) return null

  const rows = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    for (const m of MARKS) {
      const hit = m.re.exec(line)
      if (!hit) continue
      const name = m.kind === 'banner' ? bannerTitle(lines, i) : (hit[1] || '').trim()
      if (!name) break
      // A section header repeated verbatim from the line before is one thing, not two.
      const last = rows[rows.length - 1]
      if (last && last.name === name && i - last.line < 3) break
      rows.push({ line: i + 1, kind: m.kind, name: name.slice(0, 78), indent: line.length - line.trimStart().length })
      break
    }
  }
  // A span tells a reader what to ASK FOR, which a bare line number does not.
  for (let i = 0; i < rows.length; i++) {
    rows[i].to = (i + 1 < rows.length ? rows[i + 1].line - 1 : lines.length)
  }
  return { file: file, lines: lines.length, bytes: Buffer.byteLength(raw, 'utf8'), rows: rows }
}

function render (o, root) {
  const rel = path.relative(root, o.file).replace(/\\/g, '/')
  const out = []
  out.push('## ' + rel)
  out.push('')
  out.push(o.lines.toLocaleString() + ' lines, ' + o.bytes.toLocaleString() + ' bytes, about '
    + Math.round(o.bytes / 4).toLocaleString() + ' tokens to read whole. '
    + o.rows.length + ' entries below.')
  out.push('')
  out.push('Read a RANGE from this table rather than the file. In Claude Code that is')
  out.push('`Read` with `offset` and `limit`, or `sed -n \'<from>,<to>p\'`.')
  out.push('')
  out.push('| lines | what |')
  out.push('|---|---|')
  for (const r of o.rows) {
    const pad = r.indent >= 4 ? '&nbsp;&nbsp;' : ''
    out.push('| `' + r.line + '-' + r.to + '` | ' + pad + (r.kind === 'banner' || r.kind === 'head' ? '**' + r.name + '**' : '`' + r.name + '`') + ' |')
  }
  out.push('')
  return out.join('\n')
}

function main (argv) {
  const args = argv.slice(2)
  const quiet = args.indexOf('--quiet') !== -1
  const oi = args.indexOf('--out')
  const out = oi !== -1 ? args[oi + 1] : null
  const mi = args.indexOf('--min-lines')
  const minLines = mi !== -1 ? parseInt(args[mi + 1], 10) : 800
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--min-lines')

  if (!files.length) {
    process.stderr.write('usage: node make-outline.js <file>... [--out <path>] [--min-lines <n>]\n')
    return 2
  }

  const root = process.cwd()
  const parts = []
  let covered = 0, skipped = 0
  for (const f of files) {
    let o
    try { o = outlineOf(f, minLines) } catch (e) {
      process.stderr.write('make-outline: cannot read ' + f + ': ' + e.message + '\n')
      return 1
    }
    if (!o) { skipped++; continue }
    covered += o.bytes
    parts.push(render(o, root))
  }

  if (!parts.length) {
    if (!quiet) process.stdout.write('no file was over ' + minLines + ' lines, so nothing was outlined\n')
    return 3
  }

  const head = [
    '# File outline',
    '',
    'Generated by `tools/make-outline.js`. Do not hand-edit: regenerate it.',
    '',
    'These files are large enough that reading one whole is more expensive than the change you',
    'came to make. A cache read is billed at about a tenth of a fresh token and every request',
    're-sends the whole context, so a large read is not paid once, it is paid again at a tenth on',
    'every request for the rest of the session. Find the range here, then read that range.',
    '',
  ].join('\n')

  const body = head + parts.join('\n')
  if (out) {
    fs.writeFileSync(out, body, 'utf8')
    if (!quiet) {
      process.stdout.write('wrote ' + out + ': ' + parts.length + ' file(s) outlined, '
        + skipped + ' under the ' + minLines + '-line floor, ' + covered.toLocaleString()
        + ' bytes of source now navigable in ' + Buffer.byteLength(body, 'utf8').toLocaleString()
        + ' bytes of outline\n')
    }
  } else {
    process.stdout.write(body)
  }
  return 0
}

if (require.main === module) process.exit(main(process.argv))

module.exports = { main, outlineOf, render, MARKS }
