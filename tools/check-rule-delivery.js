#!/usr/bin/env node
'use strict';

/*
 * check-rule-delivery.js -- a rule claimed as shipped is PRESENT where it is claimed.
 *
 * WHY THIS EXISTS. Two findings a day apart, with the same shape and different causes:
 *
 *   ST-272. The em-dash ban was reported to the founder as a delivered rule more than once.
 *   It was in no fragment at all. grep -ci em-dash against base/fragments/brevity.md returned
 *   ZERO. The string lived in 5 of 17 base roles and every one of those was about USER-VISIBLE
 *   PRODUCT COPY, not about writing to the founder. So the rule was a session habit that the
 *   session enforced on itself and described as shipped.
 *
 *   ST-271 / S224. The 300-word cap DID ship, faithfully, into 17 of 17 role files in each of
 *   two projects, and into 0 of the 8 documents either project's session actually loads. Roles
 *   govern DISPATCHED SUBAGENTS. The founder-facing session loads CLAUDE.md and its @-imports.
 *   Four sittings of delivering the rule changed nothing, and one project's loaded governance
 *   still carried the wording the rule had REPLACED, so its roles and its session contradicted
 *   each other about reply length.
 *
 * THE COMMON FORM, and the reason this is an instrument rather than a third paragraph of
 * advice: "delivered" was measured by the act of writing rather than by reading the
 * destination, and the destination nobody checked was the file the reader actually loads.
 * A grep proves a rule exists SOMEWHERE. Only naming the destination first, and then reading
 * it, proves it arrived.
 *
 * WHAT IT REFUSES ON.
 *   - A rule's required text absent from a file it is claimed to be in.
 *   - A rule's required text absent from the LOADED SET of a named CLAUDE.md, which is that
 *     file plus its @-imports resolved all the way down. This is the ST-271 case: every
 *     individual file can be innocent and the rule still never reaches the reader.
 *   - RETIRED wording still present. A rule that replaced another has not landed while the
 *     text it replaced is still being read; that is how one project's roles and its governance
 *     came to say opposite things.
 *
 * S218 IS WHY THE REFUSAL PRINTS WHERE IT LOOKED. An absence reported by an instrument that
 * looks in one place is a claim about the instrument, not about the world. Every refusal here
 * names the full set of files searched, so the next reader can tell a missing rule from a
 * manifest pointed at the wrong directory.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK: composed role files under .claude/agents. Those are
 * generated output, -Doctor already reports drift in them, and the roster-count check already
 * holds their number. The hole this closes was never the roster; it was the LOADED set, which
 * until now nothing read for content at all.
 *
 *   node tools/check-rule-delivery.js [--manifest <path>] [--root <dir>] [--quiet]
 *
 * Exit 0 clean, 1 at least one rule did not arrive, 2 the manifest is missing or unreadable,
 * which is CANNOT TELL and not a pass.
 */

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
}
const quiet = argv.includes('--quiet');
const root = path.resolve(arg('--root', path.join(__dirname, '..')));
const manifestPath = path.resolve(arg('--manifest', path.join(root, 'tools', 'rule-delivery.json')));

function say(s) { if (!quiet) process.stdout.write(s + '\n'); }
function cannotTell(msg) {
  process.stdout.write('CANNOT TELL  ' + msg + '\n');
  process.exit(2);
}

if (!fs.existsSync(manifestPath)) {
  cannotTell('no manifest at ' + manifestPath + '. Without it this tool has no claim to test, '
    + 'and reporting that as clean is exactly the failure it was built for.');
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  cannotTell('the manifest at ' + manifestPath + ' does not parse: ' + e.message);
}
if (!manifest || !Array.isArray(manifest.rules) || manifest.rules.length === 0) {
  cannotTell('the manifest at ' + manifestPath + ' declares no rules. An empty manifest passes '
    + 'every check and proves nothing, so it is CANNOT TELL rather than clean.');
}

/* The same import rule studio.ps1 and check-context-budget.js use: a line that is nothing but
 * @something.md. Kept identical on purpose. Two instruments that disagree about what a session
 * loads produce two different answers to the same question, and S201 is that a derived value
 * must come from the same input as the thing it describes. */
function importsOf(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^@([^\s]+\.md)$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/* An import resolves against the FILE THAT DECLARES IT, not against the project root, and a
 * document reached twice is loaded once. Both of those were measured on a real two-level
 * project by ST-190; getting either wrong gives a confident answer that is wrong. */
function loadedSet(entry) {
  const out = [];
  const seen = new Set();
  const walk = (full, name) => {
    const key = path.resolve(full).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (!fs.existsSync(full)) { out.push({ name, full, missing: true, text: '' }); return; }
    const text = fs.readFileSync(full, 'utf8');
    out.push({ name, full, missing: false, text });
    for (const rel of importsOf(text)) walk(path.join(path.dirname(full), rel), rel);
  };
  walk(entry, path.basename(entry));
  return out;
}

/* Case-insensitive because a rule is prose and a heading may be capitalised differently in two
 * places. Whitespace is collapsed for the same reason: a phrase wrapped across two lines in one
 * document and on one line in another is the SAME phrase, and an instrument that says otherwise
 * refuses on formatting and teaches everyone to ignore it. */
function normalise(s) { return s.replace(/\s+/g, ' ').toLowerCase(); }
function contains(haystack, needle) { return normalise(haystack).indexOf(normalise(needle)) !== -1; }

/* EXEMPTIONS, AND WHY THEY ARE NOT A WEAKENED PATTERN. On its first run this tool refused two
 * documents that QUOTE a retired wording in order to retire it: the fragment says "until that
 * day this rule said the wrong thing" and then quotes the sentence it replaced. Both refusals
 * were correct about the text and wrong about the world.
 *
 * The tempting fix is to narrow the search string until those two stop matching. That is a
 * bandage: it makes the instrument quietly weaker everywhere to fix it in two places, and the
 * next document carrying the retired wording for real would slip through with nobody able to
 * see why. So an exemption is DECLARED, per file, with a reason, in the manifest where a reader
 * will find it. That is the same shape check-mutation-coverage uses for an accepted line.
 *
 * AND AN EXEMPTION CANNOT OUTLIVE ITS REASON. If the retired wording is no longer in an exempted
 * file, the exemption is reported as STALE and the run still fails. Otherwise the exemption list
 * grows forever and nothing ever prunes it, which is how a suppression outlives the thing it
 * suppressed and starts hiding a real finding. */
function exemptionFor(rule, fullPath) {
  for (const e of (rule.exempt || [])) {
    if (!e || !e.file) continue;
    if (path.resolve(root, e.file).toLowerCase() === fullPath.toLowerCase()) return e;
  }
  return null;
}

const findings = [];
const usedExemptions = new Set();
let checked = 0;

for (const rule of manifest.rules) {
  const name = rule.name || '(unnamed rule)';
  const ticket = rule.ticket ? ' (' + rule.ticket + ')' : '';
  const present = Array.isArray(rule.present) ? rule.present : (rule.present ? [rule.present] : []);
  const retired = Array.isArray(rule.retired) ? rule.retired : (rule.retired ? [rule.retired] : []);

  if (present.length === 0) {
    findings.push({
      rule: name,
      what: 'the manifest entry names no required text, so it can never fail and proves nothing',
      where: [manifestPath],
    });
    continue;
  }

  /* Destination kind one: named files, read directly. */
  for (const rel of (rule.files || [])) {
    const full = path.resolve(root, rel);
    checked++;
    if (!fs.existsSync(full)) {
      findings.push({ rule: name + ticket, what: 'the file it is claimed to be in does not exist', where: [full] });
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    for (const want of present) {
      if (!contains(text, want)) {
        findings.push({ rule: name + ticket, what: 'CLAIMED SHIPPED, ABSENT. Missing ' + JSON.stringify(want), where: [full] });
      }
    }
    for (const gone of retired) {
      if (!contains(text, gone)) continue;
      const ex = exemptionFor(rule, full);
      if (ex && ex.reason) { usedExemptions.add(name + '|' + path.resolve(root, ex.file).toLowerCase()); continue; }
      if (ex && !ex.reason) {
        findings.push({ rule: name + ticket, what: 'EXEMPTION WITH NO REASON. An exemption nobody has to justify is a pattern quietly switched off.', where: [full] });
        continue;
      }
      findings.push({ rule: name + ticket, what: 'RETIRED WORDING STILL PRESENT: ' + JSON.stringify(gone), where: [full] });
    }
  }

  /* Destination kind two: the set a session actually loads. This is the one that was never
   * checked, and the one that made four sittings of delivery worthless. */
  for (const rel of (rule.loaded_by || [])) {
    const entry = path.resolve(root, rel);
    checked++;
    if (!fs.existsSync(entry)) {
      findings.push({ rule: name + ticket, what: 'the entry document does not exist, so nothing is loaded from it', where: [entry] });
      continue;
    }
    const loaded = loadedSet(entry);
    const searched = loaded.map(f => f.full + (f.missing ? '  (MISSING, loads nothing)' : ''));
    for (const want of present) {
      const carrier = loaded.find(f => !f.missing && contains(f.text, want));
      if (!carrier) {
        findings.push({
          rule: name + ticket,
          what: 'REACHES NO DOCUMENT THE SESSION LOADS. Missing ' + JSON.stringify(want)
            + '. A rule delivered to the population that does not write to the founder is not delivered (S224).',
          where: searched,
        });
      } else if (!quiet) {
        say('  ok   ' + name + '  carried by ' + path.relative(root, carrier.full) + ' in the set loaded from ' + rel);
      }
    }
    for (const gone of retired) {
      /* Every carrier, not the first. A rule can be contradicted in two loaded documents at
       * once, and reporting only the first turns two faults into one, so fixing the named file
       * makes the second appear as a brand new finding the next run. */
      for (const carrier of loaded.filter(f => !f.missing && contains(f.text, gone))) {
        const ex = exemptionFor(rule, carrier.full);
        if (ex && ex.reason) { usedExemptions.add(name + '|' + path.resolve(root, ex.file).toLowerCase()); continue; }
        if (ex && !ex.reason) {
          findings.push({ rule: name + ticket, what: 'EXEMPTION WITH NO REASON. An exemption nobody has to justify is a pattern quietly switched off.', where: [carrier.full] });
          continue;
        }
        findings.push({
          rule: name + ticket,
          what: 'RETIRED WORDING IS STILL LOADED: ' + JSON.stringify(gone)
            + '. While the replaced text is still read, the rule and its predecessor contradict each other.',
          where: [carrier.full],
        });
      }
    }
  }

  /* The stale half. Run after both destination kinds so an exemption used by either counts. */
  for (const e of (rule.exempt || [])) {
    if (!e || !e.file) {
      findings.push({ rule: name + ticket, what: 'an exemption names no file, so it cannot be matched against anything', where: [manifestPath] });
      continue;
    }
    const full = path.resolve(root, e.file);
    if (!usedExemptions.has(name + '|' + full.toLowerCase())) {
      findings.push({
        rule: name + ticket,
        what: 'STALE EXEMPTION. ' + e.file + ' no longer carries the retired wording, so this exemption '
          + 'is suppressing nothing and would hide the next real one. Delete it.',
        where: [manifestPath, full],
      });
    }
  }

  if (!(rule.files || []).length && !(rule.loaded_by || []).length) {
    findings.push({
      rule: name,
      what: 'the manifest entry names no destination, so "shipped" is not a claim anything can test',
      where: [manifestPath],
    });
  }
}

say('');
say('RULE DELIVERY  ' + manifest.rules.length + ' rule(s), ' + checked + ' destination(s) read');

if (findings.length === 0) {
  say('  every rule claimed as shipped is present where it is claimed.');
  say('');
  process.exit(0);
}

process.stdout.write('\n');
for (const f of findings) {
  process.stdout.write('FAIL  ' + f.rule + '\n');
  process.stdout.write('        ' + f.what + '\n');
  /* S218. Name every place looked, not only the verdict. */
  process.stdout.write('        looked in ' + f.where.length + ' file(s):\n');
  for (const w of f.where) process.stdout.write('          ' + w + '\n');
}
process.stdout.write('\n' + findings.length + ' rule delivery failure(s).\n');
process.stdout.write('A rule is delivered when the document the reader LOADS carries it, not when it has been written somewhere.\n');
process.exit(1);
