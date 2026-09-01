<#
.SYNOPSIS
  Studio. One command for the shared agent roster and shared governance.

.DESCRIPTION
  Run -Status first. It reports every project and what it needs. Run -Doctor to fix.

  THE MODEL, in one line: there is ONE base, projects LAYER on top of it, and the
  layered result is GENERATED. Nothing is ever copied and hand-edited, because a copy
  is a fork and a fork silently stops receiving improvements.

    _STUDIO\base\agents\<role>.md            BASE roster. Stack-neutral, studio-wide.
    _STUDIO\base\governance\*.md             SHARED governance, identical everywhere.
    _STUDIO\new-project\*.md                 Scaffold for a project's OWN docs.

    <project>\.claude\agent-overlays\_project.md   this project's stack card, all roles
    <project>\.claude\agent-overlays\<role>.md     this project's delta for one role
    <project>\.claude\agents\                      GENERATED. Never edit.

    ~\.claude\agents\                        base install, for untuned projects.

.EXAMPLE
  .\studio.ps1 -Status
.EXAMPLE
  .\studio.ps1 -Doctor
  Show every action needed across the studio, without changing anything.
.EXAMPLE
  .\studio.ps1 -Sync
  Push base agents and shared governance everywhere, then rebuild tuned projects.
.EXAMPLE
  .\studio.ps1 -Tune -Project "<project-folder>"
  Start tuning a project. Scaffolds its stack card.
.EXAMPLE
  .\studio.ps1 -Compose -All
  Rebuild every tuned project after a base change.
#>
[CmdletBinding()]
param(
    [string]$StudioRoot,
    [string]$ProjectsRoot,
    [switch]$Status,
    [switch]$Doctor,
    [switch]$Sync,
    [switch]$Compose,
    [switch]$Tune,
    [switch]$Governance,
    [switch]$Global,
    [switch]$Publish,
    [switch]$Release,
    [switch]$Connect,
    [switch]$Autoload,
    [switch]$Recall,
    [switch]$Update,
    [switch]$DryRun,
    [string]$PublicRepo,
    [string]$Path,
    [string]$Project,
    [string[]]$Only,
    [switch]$All,
    [switch]$Force,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

# Everything resolves from where this script lives, so the tool is portable. Anything
# machine or organisation specific comes from studio.config.ps1, which is never published.
if (-not $StudioRoot) { $StudioRoot = $PSScriptRoot }
$CONFIG = @{}
$cfgPath = Join-Path $StudioRoot 'studio.config.ps1'
if (Test-Path $cfgPath) { $CONFIG = & $cfgPath }

# A byte copy of the studio is not a sandbox, and that is the opposite of what everyone assumes.
# studio.config.ps1 is copied with the rest of the tree and hardcodes ProjectsRoot at the REAL
# projects folder, so -Compose -All from a copy in TEMP composed the real projects. Nothing broke
# only because the output happened to be identical, which is the worst version: silent either way.
#
# The first fix required the configured root to CONTAIN the running script, and a reviewer showed
# that removes the only layout the setting exists for. A studio installed OUTSIDE its projects
# root is legitimate, and that test cannot tell it from a copy: it would warn, retarget the tool at
# its own parent, and report a successful sync having composed nothing. Three more inputs tripped
# it, all legitimate: a root equal to the studio root, a path spelled differently but resolving to
# the same place, and a relative value normalised for the test and then assigned raw.
#
# So the config IDENTIFIES ITSELF instead. OwnerRoot names the studio the config was written for,
# and a copy fails that comparison exactly, because the copy is at a different path while its
# config still names the original. A legitimate off-tree install passes, whatever its layout.
# A config with no OwnerRoot is trusted, so nothing existing breaks; the check is opt-in and the
# warning below says how to opt in.
if (-not $ProjectsRoot) {
    $selfParent   = Split-Path $StudioRoot -Parent
    $ProjectsRoot = $selfParent
    if ($CONFIG.ProjectsRoot) {
        $owner = $CONFIG.OwnerRoot
        if (-not $owner) {
            # No declaration to check against. Trust it, and say once how to make it checkable.
            $ProjectsRoot = $CONFIG.ProjectsRoot
        } else {
            $nOwn = ''; $nSelf = ''
            try {
                $nOwn  = ([System.IO.Path]::GetFullPath($owner)).TrimEnd('\', '/')
                $nSelf = ([System.IO.Path]::GetFullPath($StudioRoot)).TrimEnd('\', '/')
            } catch { }
            if ($nOwn -and $nSelf -and $nOwn.Equals($nSelf, [StringComparison]::OrdinalIgnoreCase)) {
                $ProjectsRoot = $CONFIG.ProjectsRoot
            } else {
                Write-Warning "studio.config.ps1 declares OwnerRoot '$owner' but this script is running from '$StudioRoot'. This tree is a COPY and its config travelled with it, so its ProjectsRoot names somebody else's projects. Using '$selfParent' instead. Pass -ProjectsRoot to override deliberately."
            }
        }
    }
}

if (-not $PublicRepo)   { $PublicRepo   = $CONFIG.PublicRepo }

$AGENT_BASE  = Join-Path $StudioRoot 'base\agents'
$SKILL_BASE  = Join-Path $StudioRoot 'base\skills'
$GOV_BASE    = Join-Path $StudioRoot 'base\governance'
$ARCHIVE     = Join-Path $StudioRoot '.archive'
$OVERLAY_DIR = '.claude\agent-overlays'
$AGENT_DIR   = '.claude\agents'
$CARD_NAME   = '_project.md'

# Governance files that are IDENTICAL in every project. A project's own
# WAYS_OF_WORKING and WARM_START are its own and never distributed.
$SHARED_GOV = @('GLOBAL_WAYS_OF_WORKING.md','AGENTS.md','BRIDGE_PROTOCOL.md')

# Get-Content -Raw decodes a file WITHOUT a byte order mark using the ANSI code page on
# PowerShell 5.1, not UTF-8. Agent files are deliberately BOM-less (S24), so reading one and
# writing it back re-encodes every non-ASCII character into mojibake that GROWS on each pass:
# an em dash went 8 bytes to 18 in one round trip, and -Sync never converged because three
# roles were "changed" on every run, by the sync itself. The old code escaped this only
# because Copy-Item never decodes anything.
function Read-TextUtf8 ([string]$Path) {
    [System.IO.File]::ReadAllText($Path, (New-Object System.Text.UTF8Encoding $false))
}

function Get-Sha ([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    (Get-FileHash -Path $Path -Algorithm SHA256).Hash
}

# --------------------------------------------------------------- fragments

# The advocacy block appears in 11 of the 16 roles and the ticket rule in 9, near-identical
# every time. Changing one rule meant editing eleven files by hand, which is not a chore, it is
# a defect: the edit that is too tedious to do is the edit that does not get done, and the
# roster drifts one careless paste at a time. Worse, nothing could see it. Eleven copies of a
# rule and ten of them updated looks exactly like eleven copies all updated.
#
# So a rule that belongs to every role is written once in base\fragments\<name>.md and pulled
# in with {{include: name}}.
function Get-FragmentPath ([string]$Name) { Join-Path $StudioRoot ('base\fragments\' + $Name + '.md') }

function Get-Fragment ([string]$Name) {
    $p = Get-FragmentPath $Name
    if (-not (Test-Path $p)) { return $null }
    # HTML comments are stripped. A fragment carries notes explaining itself to whoever edits
    # it next, and those are for the maintainer, not for the agent that loads the role. Two
    # fragments were shipping their own rationale into eighteen generated files.
    $body = [regex]::Replace((Read-TextUtf8 $p), '(?s)<!--.*?-->', '')
    ($body -replace '
?
\s*
?
\s*$', '').Trim()
}

# Missing fragment THROWS. It does not warn and it does not leave the marker in place.
# A role that silently loses a rule is the byte-order-mark failure again in a new costume:
# composed, current, present on disk, and quietly not doing the thing it says it does. Better
# to refuse to build than to ship sixteen agents with a hole where a rule should be.
function Expand-Fragments ([string]$Text, [string]$Where) {
    if (-not $Text) { return $Text }
    $re  = [regex]'\{\{\s*include:\s*([A-Za-z0-9_-]+)\s*\}\}'
    $out = $Text
    # Loop rather than a single pass, so a fragment may include another. One pass would insert
    # the inner marker verbatim and the leftover check below would then refuse the whole build,
    # which is a confusing way to say "nesting is not supported".
    $depth = 0
    while ($true) {
        $found = @($re.Matches($out))
        if ($found.Count -eq 0) { break }
        $depth++
        # A cycle cannot be detected by looking at one fragment, only by noticing the work never
        # finishes. Five is far past any legitimate nesting and turns an infinite loop into a
        # sentence naming the file.
        if ($depth -gt 5) {
            throw ("fragment nesting deeper than 5 in " + $Where + ", which almost certainly means two fragments include each other. Break the cycle.")
        }
        # Descending, so replacing one marker cannot shift the offsets of the ones before it.
        foreach ($m in ($found | Sort-Object -Property Index -Descending)) {
            $name = $m.Groups[1].Value
            $body = Get-Fragment $name
            if ($null -eq $body) {
                throw ("fragment '$name' does not exist. " + $Where + " asks for it, and base\fragments\$name.md is not there. Refusing to compose: an agent missing a rule looks identical to one that has it.")
            }
            # An empty fragment is almost always a half-finished edit, and inserting nothing
            # produces exactly the outcome this whole mechanism exists to prevent: a role that
            # names a rule and does not carry it.
            if (-not $body.Trim()) {
                throw ("fragment '$name' is empty. " + $Where + " asks for it, so composing would silently drop the rule it names.")
            }
            $out = $out.Remove($m.Index, $m.Length).Insert($m.Index, $body)
        }
    }
    # Anything still wearing braces is a marker this function declined to understand: a name
    # with a dot, a slash, a space. Shipping it writes a literal marker into a live agent,
    # which is worse than refusing -- the rule is missing AND the file looks deliberate.
    # Two braces are enough to be a marker. Requiring the CLOSING pair meant an unclosed
    # '{{include: brevity' sailed through compose, install AND the public export, silently,
    # with the health check reporting the fragment fine because its own scan needs a closing
    # pair too. A typo is the likeliest way a marker is ever malformed, and a truncated one
    # is the likeliest typo.
    # Only an INCLUDE marker. The previous pattern matched any '{{' at all, so a role could
    # never document Vue, Handlebars, Django or the fragment syntax itself in prose: it threw
    # naming a fragment that was never a fragment. The property being kept is narrow, an
    # include the expander declined to understand, and the pattern should be that narrow too.
    # \b after 'include'. Without it the check fired on {{ includeHeader }}, an ordinary
    # Handlebars partial a role might legitimately quote, and threw naming a fragment that was
    # never a fragment. There is no word boundary between 'e' and 'H', so the boundary excludes
    # exactly that case and keeps every real malformed marker.
    $left = [regex]::Match($out, '(?i)\{\{\s*include\b[^{}]{0,120}')
    if ($left.Success) {
        throw ("unresolved marker '" + $left.Value + "' in " + $Where + ". A fragment name is letters, digits, hyphen and underscore with no extension: {{include: brevity}}, not {{include: brevity.md}}.")
    }
    $out
}

# The full text of a base role with its fragments resolved. This, not the file on disk, is what
# gets installed and what gets hashed -- otherwise the installed copy would never again match
# its source and every role would report as drifted forever.
function Get-AgentText ([string]$Path) {
    $raw = Read-TextUtf8 $Path
    # A marker in FRONTMATTER is refused, not expanded. The overlay half of this was fixed twice
    # and the base half never was: composing left the marker literal in the generated agent, and
    # installing expanded a multi-line rule INTO the frontmatter block so it never closed, while
    # the loadability check still reported the file parseable. Frontmatter is a key-value header;
    # a rule does not belong in one under any reading.
    $lines = $raw -split "`r?`n"
    # Only scan a frontmatter block that actually CLOSES. Without this the loop ran to end of
    # file on any role whose header was absent or malformed and refused a marker sitting
    # legitimately in the body, which broke every fixture at once.
    $fmEnd = -1
    if ($lines.Count -gt 1 -and $lines[0].Trim() -eq '---') {
        # No line cap. 40 was arbitrary and a header closing at line 47 walked straight past it.
        for ($k = 1; $k -lt $lines.Count; $k++) {
            if ($lines[$k].Trim() -eq '---') { $fmEnd = $k; break }
        }
    }
    if ($fmEnd -gt 0) {
        for ($i = 1; $i -lt $fmEnd; $i++) {
            if ($lines[$i] -match '(?i)\{\{\s*include') {
                throw ("frontmatter of " + (Split-Path $Path -Leaf) + " contains a fragment marker on line " + ($i + 1) + ". Fragments are rules and belong in the body; expanding one into a frontmatter block leaves it unclosed and the agent silently unparseable.")
            }
        }
    }
    Expand-Fragments $raw ("base\agents\" + (Split-Path $Path -Leaf))
}
function Get-TextSha ([string]$Text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { (($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text)) | ForEach-Object { $_.ToString('X2') }) -join '') }
    finally { $sha.Dispose() }
}

function Get-FileTextSha ([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    Get-TextSha (Read-TextUtf8 $Path)
}

function Get-AgentTextOrNull ([string]$Path) {
    try { Get-AgentText $Path } catch { $null }
}

# Which fragments each role asks for. Used by -Doctor to report a fragment nobody includes,
# which is a rule that has quietly stopped applying to anyone.
function Get-FragmentRefs ([string]$Path) {
    # Deliberately looser than the expander. This feeds the report, and a marker too
    # malformed to expand is exactly the one a person needs told about.
    $re = [regex]'\{\{\s*include:\s*([A-Za-z0-9_.-]+)'
    @($re.Matches((Read-TextUtf8 $Path)) | ForEach-Object { $_.Groups[1].Value })
}

# Stamped into every composed agent so a surprising instruction can be traced back to
# the exact base version that produced it.
function Get-StudioVersion {
    try {
        $v = git -C $StudioRoot rev-parse --short HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $v) {
            $dirty = git -C $StudioRoot status --porcelain 2>$null
            return "$($v.Trim())$(if ($dirty) { '+local' })"
        }
    } catch {}
    'untracked'
}

function Get-BaseAgents {
    if (-not (Test-Path $AGENT_BASE)) { throw "Base roster missing at $AGENT_BASE" }
    $files = Get-ChildItem $AGENT_BASE -Filter *.md -File | Sort-Object Name
    if ($Only) {
        $want    = $Only | ForEach-Object { $_.Trim() -replace '\.md$','' }
        $picked  = $files | Where-Object { $want -contains $_.BaseName }
        $missing = $want | Where-Object { $picked.BaseName -notcontains $_ }
        if ($missing) { throw "No such role: $($missing -join ', ')" }
        return $picked
    }
    $files
}

# A DEVIATION is a base rule waived, weakened, or replaced for one project. It is the only
# dangerous kind of project-specific content, so it is the only kind that carries ceremony.
# Context (facts about the stack) and extensions (extra rules that contradict nothing) stay
# as free prose, because ceremony on the common case is how a convention dies.
# Rows are parsed from the card's markdown table: | D1 | rule | change | why | who | date | review |
function Get-Deviations ([string]$ProjectPath) {
    $card = Join-Path $ProjectPath "$OVERLAY_DIR\$CARD_NAME"
    if (-not (Test-Path $card)) { return @() }
    $out = @()
    foreach ($line in (Get-Content $card)) {
        if ($line -notmatch '^\s*\|\s*D\d+\s*\|') { continue }
        $cells = ($line -split '\|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
        if ($cells.Count -lt 6) { continue }
        $review = $null
        if ($cells.Count -ge 7 -and $cells[6] -match '^\d{4}-\d{2}-\d{2}$') { $review = [datetime]::ParseExact($cells[6],'yyyy-MM-dd',$null) }
        $out += [pscustomobject]@{
            Id = $cells[0]; Rule = $cells[1]; Change = $cells[2]; Why = $cells[3]
            Approved = $cells[4]; Date = $cells[5]; Review = $review
            Expired = ($review -and $review -lt (Get-Date))
            Unowned = ($cells[4] -in @('','-','TBD') -or $cells[5] -notmatch '^\d{4}-\d{2}-\d{2}$')
        }
    }
    $out
}

function Save-Archive ([string]$Path, [string]$Tag) {
    if (-not (Test-Path $Path)) { return }
    $dest = Join-Path $ARCHIVE ("{0}-{1}" -f $Tag, (Get-Item $Path).LastWriteTime.ToString('yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item $Path $dest -Force
}

# --------------------------------------------------------------- markdown

function Split-Doc ([string]$Path, [switch]$RequireBody) {
    $raw   = Read-TextUtf8 $Path
    $lines = $raw -split "`r?`n"
    if ($lines.Count -eq 0 -or $lines[0].Trim() -ne '---') { return @{ Front = [ordered]@{}; Body = $raw } }
    $front = [ordered]@{}; $i = 1
    while ($i -lt $lines.Count -and $lines[$i].Trim() -ne '---') {
        $idx = $lines[$i].IndexOf(':')
        if ($idx -gt 0) { $front[$lines[$i].Substring(0,$idx).Trim()] = $lines[$i].Substring($idx+1).Trim() }
        $i++
    }
    # An opening --- with no closing one is a MALFORMED document, not a document with a very
    # long header. The old code walked to the end and then sliced [$i+1 .. count-1], which in
    # PowerShell is a DESCENDING range once $i+1 passes the end: the body came back reversed,
    # the whole file was silently treated as frontmatter, and a fragment marker in it shipped
    # into the generated agent with the rule it named missing. Refusing is the only honest
    # reading; a header that never closes cannot be parsed by anything downstream either.
    if ($i -ge $lines.Count) {
        throw ((Split-Path $Path -Leaf) + " opens a frontmatter block with --- and never closes it. Nothing downstream can parse that, and the previous behaviour was to treat the entire file as a header and return the body reversed.")
    }
    # A document that ends ON its closing fence has no body, and the old slice produced one
    # anyway. $lines[($i+1)..($count-1)] is a DESCENDING range the moment $i+1 passes the end, so
    # the body came back as the single string '---'. The composer then wrote an agent whose entire
    # instruction was three hyphens, exited 0, and counted it in "16 roles composed". That is S24
    # wearing a different hat: present, current, registered, and carrying no rules at all.
    $body = if ($i -ge $lines.Count - 1) { '' } else { ($lines[($i+1)..($lines.Count-1)] -join "`r`n").Trim() }
    if ($RequireBody -and -not $body) {
        throw ("base role " + (Split-Path $Path -Leaf) + " has frontmatter and no body. A role with no body composes to an agent with no instructions: it registers normally, answers when called, and enforces nothing. Refusing is the only reading that is visible. A stack card or an overlay MAY be frontmatter only; a role may not.")
    }
    @{ Front = $front; Body = $body }
}

function Format-Front ($Front) {
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('---')
    foreach ($k in $Front.Keys) { [void]$sb.AppendLine("$($k): $($Front[$k])") }
    [void]$sb.AppendLine('---')
    $sb.ToString().TrimEnd()
}

# --------------------------------------------------------------- compose

function New-ComposedAgent ($BaseFile, $ProjectPath, $ProjectName) {
    $base = Split-Doc $BaseFile.FullName -RequireBody
    $role = $BaseFile.BaseName
    # NB: never name a local $card here. PowerShell names are case-insensitive and
    # dynamic scoping would let it shadow $CARD_NAME, silently dropping the stack card.
    $cardPath    = Join-Path $ProjectPath "$OVERLAY_DIR\$CARD_NAME"
    $overlayPath = Join-Path $ProjectPath "$OVERLAY_DIR\$role.md"

    # The header, checked here as well as in Get-AgentText. Compose reads through Split-Doc and
    # install reads through Get-AgentText; guarding only the second left a marker in a CLOSED
    # header sailing through compose and into the generated agent verbatim. Two readers, two
    # checks, or the guard is only as good as the path you happened to test.
    $front = [ordered]@{}
    foreach ($k in $base.Front.Keys) {
        if (("$k" + ' ' + [string]$base.Front[$k]) -match '(?i)\{\{\s*include') {
            throw ("frontmatter of base\agents\$role.md contains a fragment marker in key '$k'. Fragments are rules and belong in the body; a marker in a header is copied out verbatim and the rule it names never arrives.")
        }
        $front[$k] = $base.Front[$k]
    }

    # Overlays are deliberately NOT expanded: a fragment is a studio-wide rule, and a project
    # including one would duplicate what the base above already gave it. But "not expanded" was
    # silently shipping the marker itself into the generated agent, at exit 0, which falsifies
    # the promise METHOD.md makes that a generated agent never carries a marker. Refusing is the
    # only reading of that sentence that stays true.
    $rejectMarker = {
        param($Text, $Where)
        if ($Text -and [regex]::IsMatch($Text, '(?i)\{\{\s*include')) {
            throw ("$Where uses {{include: ...}}. Fragments are studio-wide rules and are resolved from base\fragments only; an overlay including one would duplicate what the base already gave this role. Write the rule out, or put it in the base if every project needs it.")
        }
    }

    $sections = @()
    if (Test-Path $cardPath) {
        $c = Split-Doc $cardPath
        # Frontmatter as well as body. A marker one line above the closing --- was invisible to
        # a body-only check and shipped into the live agent, and expanding it there leaves the
        # frontmatter block unclosed while LOADABLE still calls the file parseable.
        & $rejectMarker (Read-TextUtf8 $cardPath) "the stack card $CARD_NAME in $ProjectName"
        if ($c.Body) { $sections += $c.Body }
    }
    if (Test-Path $overlayPath) {
        $ov = Split-Doc $overlayPath
        foreach ($k in $ov.Front.Keys) { $front[$k] = $ov.Front[$k] }
        & $rejectMarker (Read-TextUtf8 $overlayPath) "the $role overlay in $ProjectName"
        if ($ov.Body) { $sections += "## $role, rules specific to $ProjectName`r`n`r`n" + $ov.Body }
    }

    $header = @"
<!-- GENERATED. DO NOT EDIT THIS FILE.
     Base    : _STUDIO\base\agents\$role.md        studio-wide, edit here for ALL projects
     Overlay : $OVERLAY_DIR\$role.md               this project only
     Card    : $OVERLAY_DIR\$CARD_NAME             this project, every role
     Studio  : $(Get-StudioVersion)
     Rebuild : _STUDIO\studio.ps1 -Compose -Project "$ProjectName"
     Edits here are destroyed on the next rebuild. -->
"@

    # Precedence and any waivers go at the TOP as well as the bottom. A note buried at the
    # divider of a 150-line file is not read first, and a waived rule the reader never sees
    # gets enforced anyway or, worse, silently ignored in the wrong direction.
    $preface = @()
    if ($sections.Count) {
        $devs = Get-Deviations $ProjectPath
        $preface += @('', "> **This project layers on top of the studio standard.** Read the ""Project layer: $ProjectName"" section at the end of this file before acting. Where it conflicts with anything above, the project layer wins.")
        if ($devs.Count) {
            $preface += @('>', "> **Active deviations from the studio base ($($devs.Count)).** These base rules do NOT apply here as written:")
            foreach ($d in $devs) {
                $flag = if ($d.Expired) { ' [REVIEW OVERDUE]' } elseif ($d.Unowned) { ' [UNOWNED]' } else { '' }
                $preface += "> - **$($d.Id)** $($d.Rule): $($d.Change). Approved $($d.Approved), $($d.Date).$flag"
            }
            $preface += @('>', '> Everything not listed above still applies in full. A deviation is not a licence to relax anything else.')
        }
    }

    # Fragments resolve here, so a composed agent carries the rule itself and never a marker.
    # Overlays are deliberately NOT expanded: a fragment is a studio-wide rule, and a project
    # including one would duplicate what the base above already gave it.
    $baseBody = Expand-Fragments $base.Body ("base\agents\$role.md")
    $parts = @((Format-Front $front), '', $header) + $preface + @('', $baseBody)
    if ($sections.Count) {
        $parts += @('', '---', '', "# Project layer: $ProjectName", '',
            'Everything above is the studio-wide standard. Everything below is specific to',
            'this project and takes precedence where the two conflict. If a rule below would',
            'help a project on a different stack, it is in the wrong place and belongs in the',
            'base roster instead.', '')
        $parts += ($sections -join "`r`n`r`n")
    }
    ($parts -join "`r`n").TrimEnd() + "`r`n"
}

# Every tree the studio owns as TEXT. base\governance is not published but IS distributed to
# every project, so it belongs in any check about what readers receive.
$PUBLISHED_TREES = @('base\agents', 'base\fragments', 'base\skills', 'base\governance',
                     'base\board', 'base\infra', 'new-project')

# A control byte does not stop a file parsing, does not stop an agent registering, and is
# invisible in every diff and every review tool. It sits in the middle of a rule. Seven were
# written into this repository in a single session, every one of them from a Windows path passed
# through a patch script where backslash-a or backslash-f is an escape. Each was found by
# accident, one only because a comment split in half and the script stopped parsing.
#
# Extracted from the reporting so it can be run against a fixture. A scan that only ever runs
# over a clean tree is a scan nobody has watched find anything.
#
# Tab, newline and carriage return are legitimate. Nothing else below 0x20 is.
function Get-ControlByteHits ([string[]]$Dirs, [string]$Trim) {
    $hits = @()
    foreach ($dir in $Dirs) {
        if (-not (Test-Path $dir)) { continue }
        foreach ($file in (Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue)) {
            $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
            foreach ($b in $bytes) {
                if ($b -lt 32 -and $b -ne 9 -and $b -ne 10 -and $b -ne 13) {
                    $name = $file.FullName
                    if ($Trim) { $name = $name.Replace($Trim.TrimEnd('\') + '\', '') }
                    $hits += ("{0}  0x{1:X2}" -f $name, $b)
                    break
                }
            }
        }
    }
    # NOT ",$hits". The comma wraps an empty result into an array CONTAINING an empty array, so
    # a clean tree came back with Count 1 and the caller printed a finding whose value was @(),
    # which is a format error, not a message. -Doctor crashed on twenty-one assertions the first
    # time this ran. A helper whose empty case is wrong is worse than no helper: the clean path
    # is the one that runs every day.
    $hits
}

# Nothing may be written until everything that could refuse has refused. -Sync ran
# Install-GlobalAgents FIRST, printed "agents updated 1" machine-wide, and only then hit the
# compose refusal and exited 1. The operator was left with a half-applied sync: the roster every
# untuned project loads had moved, no project had been composed, and the exit code said the whole
# command failed. The exit code and the disk disagreed, which is the same shape as every defect
# that cost a gate round: a signal reporting one state while the artefact holds another.
#
# Validating first costs one pass over sixteen small files and converts a half-applied write into
# a refusal with nothing written.
function Assert-BaseComposable {
    $bad = @()
    foreach ($f in (Get-BaseAgents)) {
        try {
            [void](Split-Doc $f.FullName -RequireBody)
            [void](Get-AgentText $f.FullName)
        } catch {
            $bad += ("  " + $f.BaseName + ": " + $_.Exception.Message)
        }
    }
    if ($bad.Count) {
        throw ("refused before writing anything. " + $bad.Count + " of the base roles cannot be composed:`r`n" + ($bad -join "`r`n") + "`r`nNothing was installed machine-wide and no project was touched. Fix the base and run again.")
    }
}

# --------------------------------------------------------------- discovery

# Projects only. The leading-underscore skip is deliberate and stays: everything this returns
# is fed to writers as well as to reports, so a folder in here gets composed, synced and
# written into. The studio must never be in that list. It is reported on separately, by
# Get-StudioSelf below, which is what stops the exclusion from also meaning "unwatched".
function Find-Projects {
    $found = @()
    Get-ChildItem $ProjectsRoot -Directory -Force |
        Where-Object { $_.Name -notlike '_*' -and $_.Name -notlike '.*' } | ForEach-Object {
            $d = $_
            if ((Test-Path (Join-Path $d.FullName '.git')) -or (Test-Path (Join-Path $d.FullName 'CLAUDE.md'))) { $found += $d.FullName }
            Get-ChildItem $d.FullName -Directory -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notlike '.*' -and $_.Name -ne 'node_modules' } | ForEach-Object {
                    if ((Test-Path (Join-Path $_.FullName '.git')) -or (Test-Path (Join-Path $_.FullName 'CLAUDE.md'))) { $found += $_.FullName }
                }
        }
    # Belt and braces. The name test above happens to exclude the studio because this one is
    # called _STUDIO; the path test below excludes it because it IS the studio. Rename the
    # folder without the underscore and the first test silently stops working, at which point
    # -Sync and -Compose -All would start writing into the guardian.
    $found | Sort-Object -Unique | Where-Object { -not (Test-IsInStudio $_) }
}

# -LiteralPath throughout. Test-Path and Resolve-Path treat [ ] ? and * as WILDCARDS, so
# -Compose -Project '_STUDI[O]' resolved to the studio, sailed past a guard that compares exact
# paths, reported "2 roles composed" and created a phantom folder. A guard that fails open is
# worse than no guard, because it reports success.
# Refuse to write, for two different reasons that belong in one place.
#
# STUDIO_SAFE exists because a subagent under instruction not to touch live projects composed
# one anyway, and an instruction is not a control. Anything automated sets this and the writers
# refuse rather than trusting the caller to have read the brief.
#
# The subtree test is the other half. Composition was refused for the studio by EXACT path while
# discovery excluded the whole subtree, so -Compose -Project "_STUDIO\new-project" was
# accepted
# and wrote a full roster inside the guardian.
function Assert-Writable ([string]$Path, [string]$What) {
    if ($env:STUDIO_SAFE) {
        throw "$What refused: STUDIO_SAFE is set, so this run may not write to a project. Unset it to write for real."
    }
    if (Test-IsInStudio $Path) {
        throw "$What refused for '$Path'. That is the studio or a folder inside it. The studio OWNS the base roster; composing from it would create a private fork of the thing every project shares."
    }
}

function Resolve-Project ([string]$Name) {
    $p = if (Test-Path -LiteralPath $Name) { (Resolve-Path -LiteralPath $Name).Path } else { Join-Path $ProjectsRoot $Name }
    if (-not (Test-Path -LiteralPath $p)) { throw "Project not found: $p" }
    $p
}

# The studio is not a project, and it is not exempt from inspection either. Those two facts
# were treated as one: Find-Projects skips folders starting with an underscore, so the
# guardian of the method became the only thing the method never looked at. It reported on
# eight projects and nothing at all on itself.
#
# So the studio is added back to the REPORTS by name and tagged as the studio, and to nothing
# that writes. It is deliberately NOT a project: it has no overlays and composing it would
# hand the owner of the base roster a private generated copy of that roster, which is the one
# fork this whole model exists to prevent.
function Get-StudioSelf {
    [pscustomobject]@{
        Name = Split-Path $StudioRoot -Leaf
        Path = $StudioRoot
    }
}

# Compare resolved paths, never folder names. A name test would be defeated by renaming the
# folder or by a project that happens to be called the same thing.
function Get-NormalPath ([string]$P) {
    if (-not $P) { return '' }
    $full = $P
    try { $full = [System.IO.Path]::GetFullPath($P) } catch { }
    $full.TrimEnd('\', '/')
}


# The studio root or anything beneath it. Discovery counts a folder as a project when it holds
# a .git or a CLAUDE.md, and new-project\ holds a CLAUDE.md, so without this a studio folder
# that did not start with an underscore would be discovered as a project in its own right. Only
# that one folder qualifies today; the guard is written for the subtree because the next
# subfolder to gain a CLAUDE.md will not come with a reminder.
function Test-IsInStudio ([string]$P) {
    if (-not $P) { return $false }
    $n = Get-NormalPath $P
    $s = Get-NormalPath $StudioRoot
    if ($n -eq $s) { return $true }
    $n.StartsWith($s + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
}

# a project's governance lives at its root, or at its parent when the parent is a venture
function Get-GovRoot ([string]$ProjectPath) {
    foreach ($f in $SHARED_GOV) { if (Test-Path (Join-Path $ProjectPath $f)) { return $ProjectPath } }
    $parent = Split-Path $ProjectPath -Parent
    if ($parent -ne $ProjectsRoot) {
        foreach ($f in $SHARED_GOV) { if (Test-Path (Join-Path $parent $f)) { return $parent } }
    }
    $null
}

# --------------------------------------------------------------- actions

# Records the base hash each role was installed from. Without it a difference between base
# and install is directionless: it looks identical whether the base moved forward (safe,
# just sync) or somebody hand-edited the install (dangerous, promote to base FIRST). That
# ambiguity once came within one command of force-pushing away eight files of accumulated
# agent learnings, so the manifest exists to make the two cases distinguishable.
$INSTALL_MANIFEST = '.install-manifest.json'

function Read-InstallManifest ([string]$Target) {
    $p = Join-Path $Target $INSTALL_MANIFEST
    if (-not (Test-Path $p)) { return @{} }
    $h = @{}
    try {
        $j = Get-Content $p -Raw | ConvertFrom-Json
        foreach ($prop in $j.PSObject.Properties) { $h[$prop.Name] = $prop.Value }
    } catch { }
    $h
}

# Every file this script writes goes through here.
#
# `Set-Content -Encoding utf8` means UTF-8 WITH a byte order mark on Windows PowerShell 5.1,
# and that BOM is not cosmetic. An agent file begins with `---` opening its YAML frontmatter;
# put three bytes in front of that and the frontmatter no longer parses, so the agent has no
# name and is never registered. It is composed, it is on disk, `-Doctor` reports it current,
# and it does not exist as far as the session is concerned.
#
# That shipped for weeks. Thirteen of sixteen roles were silently absent in every project,
# which is why work ran with no PM, no tech lead and no content writer while the roster
# looked healthy. The same call also wrote the STUDIO block into project CLAUDE.md files and
# corrupted them the same way.
#
# So: never Set-Content. This, always.
function Write-Utf8NoBom ([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding $false))
}

function Write-InstallManifest ([string]$Target, [hashtable]$Map) {
    $p = Join-Path $Target $INSTALL_MANIFEST
    $json = ($Map.GetEnumerator() | Sort-Object Name | ForEach-Object { [pscustomobject]@{ n = $_.Name; v = $_.Value } } |
             ForEach-Object -Begin { $o = [ordered]@{} } -Process { $o[$_.n] = $_.v } -End { [pscustomobject]$o }) |
            ConvertTo-Json -Depth 3
    [System.IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding $false))
}

function Install-GlobalAgents {
    # STUDIO_SAFE covers this too. It was added after a subagent wrote into a live project,
    # and the machine-wide install is the SAME incident class with a wider blast radius: it
    # is the roster every untuned project loads. Guarding only the composer left the hole
    # open in exactly the place the variable exists for.
    if ($env:STUDIO_SAFE -and -not $WhatIf) {
        throw "'-Sync agents' refused: STUDIO_SAFE is set, so this run may not write the machine-wide install. Unset it to write for real."
    }

    $files  = Get-BaseAgents
    $target = Join-Path $env:USERPROFILE '.claude\agents'
    if (-not (Test-Path $target) -and -not $WhatIf) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
    $man = Read-InstallManifest $target
    $upd=@(); $same=@(); $skip=@(); $unknown=@()
    foreach ($f in $files) {
        # Hash the EXPANDED text on both sides. Copying the file verbatim would install a
        # literal {{include:}} marker into every untuned project, and comparing the raw source
        # against an expanded install would report every role as drifted, permanently.
        $d = Join-Path $target $f.Name
        $text = Get-AgentText $f.FullName
        $dh = Get-FileTextSha $d; $bh = Get-TextSha $text
        $rec = $man[$f.BaseName]
        if ($null -eq $dh)     { if(-not $WhatIf){Write-Utf8NoBom $d $text}; $upd+=$f.BaseName;  $man[$f.BaseName] = $bh }
        elseif ($dh -eq $bh)   { $same+=$f.BaseName;                                                    $man[$f.BaseName] = $bh }
        # The install still matches what it was installed from, so the base is simply newer
        # and there is nothing here to lose. Overwrite without ceremony. A guard that fires
        # on every base change is a guard people learn to pass -Force to reflexively.
        # Accept the legacy hash too. Every manifest written before fragments existed stores a
        # FILE hash of the base, and this now compares EXPANDED TEXT hashes. Without this, the
        # first sync after upgrading reports the entire roster as hand-edited and refuses to
        # touch it -- on every machine, for everyone, at once. The entry is rewritten in the
        # new form on the way through, so the shim stops applying after one sync.
        elseif ($rec -and ($dh -eq $rec -or (Get-Sha $d) -eq $rec)) { if(-not $WhatIf){Write-Utf8NoBom $d $text}; $upd+=$f.BaseName; $man[$f.BaseName] = $bh }
        elseif ($Force)        { if(-not $WhatIf){Write-Utf8NoBom $d $text}; $upd+=$f.BaseName;  $man[$f.BaseName] = $bh }
        elseif ($rec)          { $skip+=$f.BaseName }
        else                   { $unknown+=$f.BaseName }
        # A skipped role keeps whatever it was last installed from. That stale entry is the
        # evidence the install has since been hand-edited; overwriting it would erase it.
    }
    if (-not $WhatIf) { Write-InstallManifest $target $man }
    Write-Host "  agents  updated $($upd.Count), current $($same.Count)" -ForegroundColor Gray
    if ($skip.Count) {
        Write-Host "  EDITED IN THE INSTALL, so not overwritten: $($skip -join ', ')" -ForegroundColor Yellow
        Write-Host "  that change exists nowhere else. Promote it into base\agents, then sync." -ForegroundColor Yellow
    }
    if ($unknown.Count) {
        Write-Host "  differs with no record of what it was installed from: $($unknown -join ', ')" -ForegroundColor Yellow
        Write-Host "  direction unknown, so not overwritten. Diff against base\agents, then -Sync -Force" -ForegroundColor Yellow
        Write-Host "  once you are satisfied nothing is lost. That records the baseline for next time." -ForegroundColor Yellow
    }
}

# Skills are the procedures: wind-down, release, and so on. Unlike agents they are not
# composed per project, because a procedure is the same everywhere. A project needing a
# variant overrides by name in its own .claude/skills.
function Install-GlobalSkills {
    # STUDIO_SAFE covers this too. It was added after a subagent wrote into a live project,
    # and the machine-wide install is the SAME incident class with a wider blast radius: it
    # is the roster every untuned project loads. Guarding only the composer left the hole
    # open in exactly the place the variable exists for.
    if ($env:STUDIO_SAFE -and -not $WhatIf) {
        throw "'-Sync skills' refused: STUDIO_SAFE is set, so this run may not write the machine-wide install. Unset it to write for real."
    }

    if (-not (Test-Path $SKILL_BASE)) { return }
    $target = Join-Path $env:USERPROFILE '.claude\skills'
    if (-not (Test-Path $target) -and -not $WhatIf) { New-Item -ItemType Directory -Path $target -Force | Out-Null }

    $upd = @(); $same = @()
    foreach ($skill in (Get-ChildItem $SKILL_BASE -Directory)) {
        $src = Join-Path $skill.FullName 'SKILL.md'
        if (-not (Test-Path $src)) { continue }
        $dst = Join-Path $target $skill.Name
        if ((Get-Sha $src) -eq (Get-Sha (Join-Path $dst 'SKILL.md'))) { $same += $skill.Name; continue }
        if (-not $WhatIf) {
            New-Item -ItemType Directory -Path $dst -Force | Out-Null
            Copy-Item "$($skill.FullName)\*" $dst -Recurse -Force
        }
        $upd += $skill.Name
    }
    Write-Host ("  skills  updated {0}, current {1}{2}" -f $upd.Count, $same.Count, $(if ($upd.Count) { ": $($upd -join ', ')" } else { '' })) -ForegroundColor Gray
}

function Sync-Governance ([string]$GovRoot, [string]$Label) {
    # Harmless today only because Get-GovRoot returns null for a studio that holds no
    # GLOBAL_WAYS_OF_WORKING.md, which is an accident of content rather than a guard.
    if ($env:STUDIO_SAFE -and -not $WhatIf) {
        throw "-Sync governance refused: STUDIO_SAFE is set. Unset it to write for real."
    }
    Assert-Writable $GovRoot '-Sync governance'

    # base\governance is deliberately outside $PUBLIC_MANIFEST (S8): the method is public, what any
    # project actually knows is not. The consequence nobody had stated is that a public user runs
    # -Sync, receives sixteen roles, receives NO governance, and is told nothing. The roster is
    # WRITTEN AGAINST that governance: roles refer to the release protocol, the board protocol and
    # the deploy gates as things that exist. Sixteen agents assuming a rulebook they were never
    # given is a green signal over half an artefact.
    $govMissing = @($SHARED_GOV | Where-Object { -not (Test-Path (Join-Path $GOV_BASE $_)) })
    if ($govMissing.Count -eq $SHARED_GOV.Count) {
        Write-Host "  no shared governance to place. This install carries none, so none was placed." -ForegroundColor Yellow
        Write-Host "  The roles reference a release protocol, a board protocol and deploy gates as things" -ForegroundColor Yellow
        Write-Host "  that exist. Write your own at base\governance\, or delete the import lines from this" -ForegroundColor Yellow
        Write-Host "  project's CLAUDE.md so nothing points at a document nobody has." -ForegroundColor Yellow
    } elseif ($govMissing.Count) {
        Write-Host ("  missing from base\governance: " + ($govMissing -join ', ')) -ForegroundColor Yellow
        Write-Host "  Synced without these. Roles may reference rules no reader has." -ForegroundColor Yellow
    }

    $upd=@(); $same=@(); $drift=@()
    foreach ($f in $SHARED_GOV) {
        $src = Join-Path $GOV_BASE $f
        $dst = Join-Path $GovRoot $f
        if (-not (Test-Path $src)) { continue }
        $dh = Get-Sha $dst
        if ($null -eq $dh)                      { if(-not $WhatIf){Copy-Item $src $dst -Force}; $upd+=$f }
        elseif ($dh -eq (Get-Sha $src))         { $same+=$f }
        elseif ($Force)                         { if(-not $WhatIf){ Save-Archive $dst "gov-$Label"; Copy-Item $src $dst -Force }; $upd+=$f }
        else                                    { $drift+=$f }
    }
    if ($upd.Count)   { Write-Host "  governance updated: $($upd -join ', ')" -ForegroundColor Green }
    if ($same.Count)  { Write-Host "  governance current: $($same.Count) file(s)" -ForegroundColor Gray }
    if ($drift.Count) { Write-Host "  governance DRIFTED: $($drift -join ', ') (use -Force to reset from base, archived first)" -ForegroundColor Yellow }
}

function Initialize-Tuning ([string]$Name) {
    $path = Resolve-Project $Name
    # Tuning is the only door to composing. Leaving it open would let the studio be given an
    # overlay folder that Build-Project then refuses to act on, which is a worse state than
    # either: a stack card that looks live and is never applied to anything.
    Assert-Writable $path '-Tune'
    $dir  = Join-Path $path $OVERLAY_DIR
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $cardPath = Join-Path $dir $CARD_NAME
    if (Test-Path $cardPath) { Write-Host "  stack card exists: $cardPath" -ForegroundColor DarkGray; return }
    $proj = Split-Path $path -Leaf
    @"
# Project layer, applied to EVERY role on $proj

Layered onto every studio agent when this project's roster is composed. Keep it to what
is TRUE OF THIS PROJECT AND NOT OF OTHERS. Anything that would help a project on a
different stack belongs in the base roster at _STUDIO\base\agents, not here.

## Stack

[Languages, frameworks, database, auth, hosting. Be specific. This is what stops an agent
reaching for a pattern that belongs to a different project.]

## How access is enforced

[Where authorisation actually lives here, and what a reviewer should therefore look for.
Name the real mechanism, so nobody hunts for one this stack does not have.]

## Deviations from the studio base

Only for a base rule this project WAIVES, WEAKENS or REPLACES. Facts about the stack are
context and belong above; extra rules that contradict nothing are extensions and belong
below. Neither is a deviation and neither needs an entry here.

Every row needs an approver and a date. A deviation with neither is a defect, not a rule.
Security gates and the three-gate deploy rule can never be waived here; those need CEO
sign-off recorded in governance.

| # | Base rule affected | What changes | Why | Approved | Date | Review |
|---|---|---|---|---|---|---|
| - | - | - | - | - | - | - |

## Conventions

[Naming, folder layout, ticket prefix, branch and release conventions, anything a new
agent would otherwise guess at.]
"@ | ForEach-Object { Write-Utf8NoBom $cardPath $_ }
    Write-Host "  created stack card: $cardPath" -ForegroundColor Green
    Write-Host "  Fill it in, then: studio.ps1 -Compose -Project `"$Name`"" -ForegroundColor DarkGray
}

function Build-Project ([string]$ProjectPath, [switch]$Quiet, [switch]$Silent) {
    $proj       = Split-Path $ProjectPath -Leaf
    # Refused here rather than only at the -Compose switch, because every path that composes
    # anything comes through this function: -Compose -Project, -Compose -All, -Sync, -Update
    # and the autoload hook. A guard on one entry point is a guard the other five walk past.
    if (Test-IsInStudio $ProjectPath) {
        if (-not $Quiet -and -not $Silent) {
            Write-Host "  $proj is the studio, or inside it. Nothing to compose: it OWNS the base roster." -ForegroundColor DarkGray
        }
        return
    }
    # An automated run must not write into a live project. This is a control rather than an
    # instruction because an instruction was already given, and a subagent composed a real
    # project anyway.
    if ($env:STUDIO_SAFE -and -not $WhatIf) {
        throw "compose refused for '$proj': STUDIO_SAFE is set. Unset it to write for real."
    }
    $overlayDir = Join-Path $ProjectPath $OVERLAY_DIR
    $agentDir   = Join-Path $ProjectPath $AGENT_DIR
    if (-not (Test-Path $overlayDir)) { if (-not $Quiet) { Write-Host "  $proj has no overlays, runs on the base install" -ForegroundColor DarkGray }; return }

    $hasCard  = Test-Path (Join-Path $overlayDir $CARD_NAME)
    $roleOv   = @(Get-ChildItem $overlayDir -Filter *.md -File | Where-Object { $_.Name -ne $CARD_NAME } | ForEach-Object { $_.BaseName })
    $files    = if ($hasCard) { Get-BaseAgents } else { Get-BaseAgents | Where-Object { $roleOv -contains $_.BaseName } }
    if (-not $files) { Write-Host "  $proj overlay folder is empty" -ForegroundColor DarkGray; return }
    if (-not (Test-Path $agentDir) -and -not $WhatIf) { New-Item -ItemType Directory -Path $agentDir -Force | Out-Null }

    # Compose EVERYTHING before writing ANYTHING. The old loop wrote each agent as it went, so a
    # throw on role nine left eight freshly composed agents on disk beside a .sync-manifest.json
    # describing the PREVIOUS build, with the stale-role cleanup skipped. The project is then in a
    # state no later run reports honestly: the manifest and the files disagree, which is the exact
    # ambiguity the manifest was added to remove.
    $composed = [ordered]@{}
    $manifest = @{}
    foreach ($f in $files) {
        $composed[$f.Name] = New-ComposedAgent $f $ProjectPath $proj
        # Record the hash of the EXPANDED text, not of the base file. A fragment edit does not
        # change one byte of base\agents\<role>.md, so a file hash cannot see it: every tuned
        # project reported "composed and current" while carrying the old wording of a rule that
        # had just been changed studio-wide. The reader in -Status already accepted either form;
        # it was this writer that never produced the one that can move. Readers still accept the
        # file hash, so a manifest written before this line changed is not treated as drifted.
        $manifest[$f.BaseName] = @{ base = Get-TextSha (Get-AgentText $f.FullName) }
    }
    if (-not $WhatIf) {
        foreach ($n in @($composed.Keys)) { Write-Utf8NoBom (Join-Path $agentDir $n) $composed[$n] }
        Write-Utf8NoBom (Join-Path $agentDir '.sync-manifest.json') ($manifest | ConvertTo-Json -Depth 5)
        Get-ChildItem $agentDir -Filter *.md -File | Where-Object { $files.Name -notcontains $_.Name } | ForEach-Object { Remove-Item $_.FullName -Force }
    }
    if (-not $Silent) {
        Write-Host ("  {0}: {1} roles composed, card {2}, overlays [{3}]" -f $proj, $files.Count, $(if($hasCard){'yes'}else{'no'}), $(if($roleOv.Count){$roleOv -join ', '}else{'none'})) -ForegroundColor Green
    }
}

# --------------------------------------------------------------- release note

# CHANGELOG.md is the single source of what changed and why, written for outsiders rather
# than for us. Both the private commit and the public publish use it, so the two repos
# never tell different stories about the same release.
function Get-ReleaseNote {
    $clPath = Join-Path $StudioRoot 'CHANGELOG.md'
    if (-not (Test-Path $clPath)) { return $null }
    $cl = Read-TextUtf8 $clPath
    # the boundary must be a DATED heading; a '##' inside a fenced example would end it early
    $sec = [regex]::Match($cl, '(?ms)^## (\d{4}-\d{2}-\d{2})\s*\r?\n(.*?)(?=^## \d{4}-\d{2}-\d{2}|^## Earlier|\z)')
    if (-not $sec.Success) { return $null }

    $notes = $sec.Groups[2].Value.Trim()
    $heads = @([regex]::Matches($notes, '(?m)^### (.+)$') | ForEach-Object { $_.Groups[1].Value })
    $subject = if ($heads.Count -eq 1) { $heads[0] }
               elseif ($heads.Count)   { "$($heads[0]), and $($heads.Count - 1) other change(s)" }
               else                    { "Release $($sec.Groups[1].Value)" }
    # the first heading becomes the subject, so it does not need repeating in the body
    $body = ($notes -replace '(?m)^### .+\r?\n\r?\n?', '').Trim()
    @{ Date = $sec.Groups[1].Value; Subject = $subject; Body = $body }
}

# Never `git commit -m` a multi-line message from PowerShell. Fenced code and blank lines
# get mangled in native-command argument passing: the commit silently fails and the changes
# just sit staged while the script reports success.
function Invoke-GitCommitFile ([string]$RepoPath, [string]$Message, $IdArgs) {
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("studio-msg-{0}.txt" -f [guid]::NewGuid())
    [System.IO.File]::WriteAllText($tmp, $Message, (New-Object System.Text.UTF8Encoding $false))
    git -C $RepoPath @IdArgs commit -q -F $tmp
    $ok = ($LASTEXITCODE -eq 0)
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    $ok
}

# --------------------------------------------------------------- publish

# The patterns live in studio.config.ps1, not here, because the list itself names every
# project and client and must never be published. No config means no publishing: the scan
# fails closed rather than waving everything through.
$LEAK_PATTERNS = if ($CONFIG.LeakPatterns) { $CONFIG.LeakPatterns } else { $null }

# A scanner nobody has watched fail is a scanner nobody has tested.
#
# On 2026-08-07 this one ran, reported clean, and published a name it was configured to
# block. The pattern was anchored at both ends and the name appeared inside a compound word,
# so it never matched. It did not error and it did not warn, which is the whole problem: a
# check that cannot fail is indistinguishable from a check that always passes.
#
# So every rule carries a sample it is REQUIRED to match, and the publish refuses to run if
# any rule has no sample or fails its own. The samples live in studio.config.ps1, beside the
# patterns. They cannot live in this file: this file is published, and a file listing a
# known-bad example of every blocked name would leak precisely what the scanner protects.
function Test-LeakPatterns {
    $bad = @()
    foreach ($rule in $LEAK_PATTERNS) {
        $why = if ($rule.why) { $rule.why } else { $rule.p }
        if (-not $rule.sample) {
            $bad += "no sample to prove it fires  ->  $why"
        } elseif ($rule.sample -notmatch $rule.p) {
            $bad += "sample does NOT match its own pattern  ->  $why  [pattern $($rule.p), sample '$($rule.sample)']"
        }
    }
    $bad
}

function Invoke-LeakScan ([string]$Dir) {
    if (-not $LEAK_PATTERNS) { throw "No leak patterns configured. Refusing to publish without a scan. Add LeakPatterns to studio.config.ps1." }

    # Fails closed, before anything is scanned. A pattern that cannot catch its own known-bad
    # sample will not catch the real thing either, and a clean report from it means nothing.
    $selfTest = Test-LeakPatterns
    if ($selfTest) {
        throw ("Leak scanner SELF-TEST FAILED. Refusing to publish.`n  " + ($selfTest -join "`n  ") +
               "`n`nEvery rule in LeakPatterns needs a `sample` that it matches. Fix the pattern, or fix the sample.")
    }
    Write-Host ("  self-test passed, {0} patterns each proved against a known-bad sample" -f $LEAK_PATTERNS.Count) -ForegroundColor DarkGray

    $findings = @()
    # Scan EVERY file, not a list of extensions. LICENSE and CNAME have no extension and
    # were silently skipped, which meant anything could have gone public inside them.
    # Binary is skipped by content sniff rather than by name.
    foreach ($f in (Get-ChildItem $Dir -Recurse -File -ErrorAction SilentlyContinue)) {
        $head = [System.IO.File]::ReadAllBytes($f.FullName) | Select-Object -First 512
        if ($head -contains 0) { continue }
        $lines = Get-Content $f.FullName
        for ($i = 0; $i -lt $lines.Count; $i++) {
            foreach ($rule in $LEAK_PATTERNS) {
                if ($rule.allowIn -and ($rule.allowIn -contains $f.Name)) { continue }
                if ($lines[$i] -match $rule.p) {
                    $findings += [pscustomobject]@{
                        File = $f.FullName.Replace("$Dir\", ''); Line = $i + 1
                        Why  = $rule.why; Text = $lines[$i].Trim()
                    }
                }
            }
        }
    }
    $findings
}

# The public export. Only these paths ever leave the private repo.
$PUBLIC_MANIFEST = @(
    @{ from = 'base\agents';  to = 'agents' },
    # Published so the mechanism travels with the roster. Agent files are ALSO expanded on
    # the way out, so a role copied straight from the export is a complete document rather
    # than one with a hole and a marker where a rule should be.
    @{ from = 'base\fragments'; to = 'fragments' },
    @{ from = 'new-project';  to = 'new-project' },
    @{ from = 'studio.ps1';   to = 'studio.ps1' },
    # The site is five real pages now, not one long scroll. Each needs its own title and
    # description to be worth anything in a search result, which a single document cannot do.
    @{ from = 'index.html';      to = 'index.html' },
    @{ from = 'problem.html';    to = 'problem.html' },
    @{ from = 'solution.html';   to = 'solution.html' },
    @{ from = 'prototypes.html'; to = 'prototypes.html' },
    @{ from = 'how-to.html';     to = 'how-to.html' },
    # Generated from CHANGELOG.md, never hand-edited. The generator ships beside it so a
    # fork can rebuild the page rather than inheriting one it cannot regenerate.
    @{ from = 'releases.html';   to = 'releases.html' },
    @{ from = 'reference.html';  to = 'reference.html' },
    @{ from = 'tools';           to = 'tools' },
    @{ from = 'site.css';        to = 'site.css' },
    @{ from = 'site.js';         to = 'site.js' },
    @{ from = 'METHOD.md';    to = 'METHOD.md' },
    @{ from = 'CHANGELOG.md'; to = 'CHANGELOG.md' },
    @{ from = 'LICENSE';      to = 'LICENSE' },
    @{ from = 'LICENCE-NOTES.md'; to = 'LICENCE-NOTES.md' },
    @{ from = 'base\board';   to = 'board' },
    @{ from = 'base\infra';   to = 'infra' },
    @{ from = 'base\skills';  to = 'skills' },
    @{ from = 'robots.txt';   to = 'robots.txt' },
    @{ from = 'sitemap.xml';  to = 'sitemap.xml' },
    # Publishes so a clone of the EXPORT gets the line endings this was tested with. It was
    # added to the private repo and not here, and the two are different repositories: the one
    # strangers clone had no attributes file at all, so every text file arrived rewritten.
    # Measured before acting: the script still parses and all sixteen roles still register, so
    # the cost today is nil. What was not true is that a public clone matches what was tested,
    # and that is the property the rule exists for rather than a symptom anyone had hit.
    # Cloudflare Pages serves this with a real 404 for any path it cannot match. Without it the
    # host answered every unknown URL with the home page and HTTP 200, so a search engine could
    # index unlimited duplicates of one page under junk addresses, a stale link never told
    # anyone it was wrong, and a page that had never been published was indistinguishable from
    # one that had. That last one is how this was found: a health check reported /reference
    # healthy before it existed.
    @{ from = '404.html';     to = '404.html' },
    @{ from = '.gitattributes'; to = '.gitattributes' },
    @{ from = '_headers';     to = '_headers' },
    @{ from = 'og.png';       to = 'og.png' }
)

function Publish-Public ([string]$RepoUrl, [switch]$DryRun) {
    # The outward-facing writers. STUDIO_SAFE was added after an automated run wrote where
    # it should not have, and these two write to a PUBLIC remote, which is the one write
    # that cannot be undone by running the tool again.
    if ($env:STUDIO_SAFE) {
        throw "publish refused: STUDIO_SAFE is set. Unset it to publish for real."
    }
    $stage = Join-Path $StudioRoot '.public'
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Path $stage -Force | Out-Null

    Write-Host ""
    Write-Host "STAGING PUBLIC EXPORT" -ForegroundColor Cyan
    foreach ($m in $PUBLIC_MANIFEST) {
        $src = Join-Path $StudioRoot $m.from
        $dst = Join-Path $stage $m.to
        if (-not (Test-Path $src)) { continue }
        if ((Get-Item $src).PSIsContainer) {
            New-Item -ItemType Directory -Path $dst -Force | Out-Null
            Copy-Item "$src\*" $dst -Recurse -Force
            Write-Host ("  {0,-16} -> {1} ({2} files)" -f $m.from, $m.to, (Get-ChildItem $dst -Recurse -File).Count)
        } else {
            Copy-Item $src $dst -Force
            Write-Host ("  {0,-16} -> {1}" -f $m.from, $m.to)
        }
    }

    # Resolve fragments in the exported roles. Copy-Item is verbatim, so without this the export
    # ships sixteen role files each containing a literal {{include: ...}} and the rule it names
    # nowhere in the file. Anyone dropping one into .claude\agents gets an agent that is missing a
    # rule and looks deliberate about it. The fragments folder is published too, so the mechanism
    # still travels for anyone editing the roster rather than just consuming it.
    $stagedAgents = Join-Path $stage 'agents'
    if (Test-Path $stagedAgents) {
        $expanded = 0
        foreach ($a in (Get-ChildItem $stagedAgents -Filter *.md -File)) {
            $txt = Read-TextUtf8 $a.FullName
            $new = Expand-Fragments $txt ("export\agents\" + $a.Name)
            if ($new -ne $txt) { Write-Utf8NoBom $a.FullName $new; $expanded++ }
        }
        if ($expanded) { Write-Host ("  fragments resolved in {0} exported role(s)" -f $expanded) }
    }

    Write-Host ""
    Write-Host "LEAK SCAN" -ForegroundColor Cyan
    $findings = Invoke-LeakScan $stage
    if ($findings) {
        Write-Host "  BLOCKED. $($findings.Count) finding(s). Nothing was pushed." -ForegroundColor Red
        $findings | Group-Object Why | ForEach-Object {
            Write-Host ("  [{0}] {1} hit(s)" -f $_.Name, $_.Count) -ForegroundColor Yellow
            $_.Group | Select-Object -First 3 | ForEach-Object {
                Write-Host ("      {0}:{1}  {2}" -f $_.File, $_.Line, $_.Text.Substring(0,[Math]::Min(90,$_.Text.Length))) -ForegroundColor DarkYellow
            }
        }
        Write-Host ""
        Write-Host "  Fix the source in the private repo, then publish again." -ForegroundColor DarkGray
        return $false
    }
    Write-Host "  clean, $((Get-ChildItem $stage -Recurse -File).Count) files cleared for publication" -ForegroundColor Green

    if ($DryRun) {
        Write-Host ""
        Write-Host "  DRY RUN. Staged at $stage. Nothing pushed." -ForegroundColor DarkGray
        return $true
    }

    # Clone the public repo and update it in place. The old version init'd a fresh repo and
    # force-pushed, which meant the public history was a single ever-replaced commit with a
    # hardcoded message: no diffs, no record of what changed, and any contribution or fork
    # silently destroyed on the next publish.
    $work = Join-Path $StudioRoot '.publish-work'
    if (Test-Path $work) { Remove-Item $work -Recurse -Force }

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'   # git writes harmless CRLF notices to stderr
    try {
        git clone -q $RepoUrl $work 2>$null
        if (-not (Test-Path (Join-Path $work '.git'))) { Write-Host "  could not clone $RepoUrl" -ForegroundColor Red; return $false }

        Push-Location $work
        $branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
        if (-not $branch) { $branch = 'main' }

        # What did the studio change since we last published? The previous publish recorded
        # the studio commit it came from, so the message can say what actually changed.
        # absent on the first publish, so match defensively rather than indexing a null
        $lastSha = $null
        $m = [regex]::Match(((git log -1 --format=%B 2>$null) -join "`n"), 'Studio-Source:\s*(\S+)')
        if ($m.Success) { $lastSha = $m.Groups[1].Value }
        Pop-Location

        # replace only the paths the studio owns; anything else in the repo is left alone
        foreach ($m in $PUBLIC_MANIFEST) {
            $target = Join-Path $work $m.to
            if (Test-Path $target) { Remove-Item $target -Recurse -Force }
        }
        Get-ChildItem $stage -Force | ForEach-Object { Copy-Item $_.FullName (Join-Path $work $_.Name) -Recurse -Force }

        Push-Location $work
        git add -A
        $changed = @(git diff --cached --name-only) | Where-Object { $_ }
        if (-not $changed.Count) {
            Write-Host ""
            Write-Host "  nothing changed since the last publish" -ForegroundColor DarkGray
            Pop-Location
            return $true
        }

        $studioSha = (git -C $StudioRoot rev-parse HEAD 2>$null).Trim()

        $note    = Get-ReleaseNote
        $subject = if ($note) { $note.Subject } else { "Update: $($changed.Count) file(s) changed" }
        $body    = if ($note) { $note.Body }    else { "Files updated: " + (($changed | Select-Object -First 10) -join ', ') }

        $msg = @"
$subject

$body

$($changed.Count) file(s) changed: $(($changed | Select-Object -First 10) -join ', ')
Full history and rationale: CHANGELOG.md

Studio-Source: $studioSha
"@
        $who = $CONFIG.PublishAs
        $idArgs = if ($who) { @('-c', "user.name=$($who.Name)", '-c', "user.email=$($who.Email)") } else { @() }
        $committed = Invoke-GitCommitFile $work $msg $idArgs

        if (-not $committed) {
            Write-Host ""
            Write-Host "  COMMIT FAILED. Nothing pushed. Staged changes are in $work" -ForegroundColor Red
            Pop-Location
            return $false
        }

        git push -q origin $branch
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "  PUSH FAILED. Committed locally in $work but not published." -ForegroundColor Red
            Pop-Location
            return $false
        }

        # verify against the remote rather than trusting the exit code
        $localSha  = (git rev-parse HEAD).Trim()
        $remoteSha = ((git ls-remote origin $branch) -split '\s+')[0]
        Pop-Location
        if ($localSha -ne $remoteSha) {
            Write-Host ""
            Write-Host "  PUBLISH UNVERIFIED: remote head does not match what was pushed." -ForegroundColor Red
            return $false
        }

        Write-Host ""
        Write-Host "  published to $RepoUrl ($branch), commit $($localSha.Substring(0,7))" -ForegroundColor Green
        Write-Host ("  {0} file(s): {1}" -f $changed.Count, (($changed | Select-Object -First 6) -join ', ')) -ForegroundColor Gray
        Write-Host ("  release note: {0}" -f $subject) -ForegroundColor Gray

        Invoke-SiteDeploy
    } finally { $ErrorActionPreference = $prevEAP }
    $true
}

# Pushing is not publishing when the host does not rebuild on push.
#
# The site host reports the project as disconnected from the git account while simultaneously
# showing the repository connected with automatic deployments on, and a push provably did not
# produce a build. Rather than depend on a linkage that reports itself as both, the release
# asks for the rebuild directly.
#
# The hook URL is a credential and lives in studio.config.ps1, which is never published. With
# no hook configured this says so and moves on, because a studio that does not host a public
# site should not be nagged about one.
function Invoke-SiteDeploy {
    $hook = $CONFIG.PagesDeployHook
    if (-not $hook) { return }
    if ($WhatIf)   { Write-Host "  would trigger a site rebuild" -ForegroundColor DarkGray; return }

    try {
        $r = Invoke-RestMethod -Uri $hook -Method Post -TimeoutSec 30
        if ($r.success) { Write-Host "  site rebuild triggered" -ForegroundColor Gray }
        else {
            $why = ($r.errors | ForEach-Object { $_.message }) -join '; '
            Write-Host "  SITE REBUILD REFUSED: $why" -ForegroundColor Yellow
            Write-Host "  the push succeeded; the site is serving the previous build until this is fixed." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  SITE REBUILD FAILED: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  the push succeeded; the site is serving the previous build until this is fixed." -ForegroundColor Yellow
    }
}

# --------------------------------------------------------------- release

# One action, one note, both repos. Splitting these was how the QA change ended up
# committed privately and never published, with nothing reporting the gap.
function Invoke-Release {
    # The outward-facing writers. STUDIO_SAFE was added after an automated run wrote where
    # it should not have, and these two write to a PUBLIC remote, which is the one write
    # that cannot be undone by running the tool again.
    if ($env:STUDIO_SAFE) {
        throw "release refused: STUDIO_SAFE is set. Unset it to release for real."
    }
    $note = Get-ReleaseNote
    if (-not $note) { Write-Host "  No dated section in CHANGELOG.md. Add one before releasing." -ForegroundColor Red; return $false }

    # git writes CRLF notices to stderr and PowerShell treats those as terminating
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { Invoke-ReleaseInner $note } finally { $ErrorActionPreference = $prevEAP }
}

function Invoke-ReleaseInner ($note) {

    Write-Host ""
    Write-Host "RELEASE  $($note.Date)" -ForegroundColor Cyan
    Write-Host "  $($note.Subject)" -ForegroundColor White

    # 1. the private repo, using the same note
    $dirty = @(git -C $StudioRoot status --porcelain 2>$null | Where-Object { $_ })
    if ($dirty.Count) {
        # -WhatIf must not touch the index. This ran `git add -A` first and only tested
        # $WhatIf afterwards, so a preview staged 46 paths on the real repository, including an
        # untracked file that was neither ignored nor anything to do with the studio. A preview
        # that mutates the thing it is previewing is not a preview. Read the same list from the
        # working tree instead, which is what `add -A` would have staged anyway.
        if ($WhatIf) {
            $files = @(git -C $StudioRoot status --porcelain --untracked-files=all |
                        Where-Object { $_ } | ForEach-Object { $_.Substring(3).Trim('"') })
        } else {
            git -C $StudioRoot add -A 2>$null
            $files = @(git -C $StudioRoot diff --cached --name-only) | Where-Object { $_ }
        }
        $msg = @"
$($note.Subject)

$($note.Body)

$($files.Count) file(s) changed: $(($files | Select-Object -First 10) -join ', ')
"@
        if ($WhatIf) {
            Write-Host "  would commit $($files.Count) file(s) to the private repo" -ForegroundColor DarkGray
        } else {
            if (-not (Invoke-GitCommitFile $StudioRoot $msg @())) {
                Write-Host "  PRIVATE COMMIT FAILED. Nothing published." -ForegroundColor Red
                return $false
            }
            git -C $StudioRoot push -q origin HEAD 2>$null
            if ($LASTEXITCODE -ne 0) { Write-Host "  private push failed" -ForegroundColor Red; return $false }
            Write-Host "  private : committed and pushed, $($files.Count) file(s)" -ForegroundColor Green
        }
    } else {
        Write-Host "  private : nothing to commit" -ForegroundColor DarkGray
    }

    # 2. the public repo, from the same note
    if ($WhatIf) { Write-Host "  would publish to $PublicRepo" -ForegroundColor DarkGray; return $true }
    Publish-Public $PublicRepo
}

# --------------------------------------------------------------- session brief

# WHY THIS EXISTS. -Doctor reports on every project and only ever runs in the studio, so the
# session that could act on a finding is the one session that never sees it. One project ran a
# roster sixteen roles stale and nobody working there could have known; another imported a
# document retired seventeen days earlier while reporting itself healthy.
#
# TWO RULES SHAPE THIS, both from the assessment and both binding.
#
# It NAMES the broken rule and the fix. "Possible drift" is a smoke alarm with no address, and
# this studio already publishes a REALITY line that nine projects have learned to ignore.
#
# It is SILENT when nothing is wrong, so silence carries information. That is also the measure:
# of the first ten project sessions, it must say nothing on the healthy ones and name a real
# fixable problem on at least one. Never firing means it is decoration and gets deleted; firing
# on healthy projects means it is noise and gets tightened.
function Get-ProjectBrief ([string]$ProjectPath) {
    $findings = @()
    if (-not $ProjectPath -or -not (Test-Path $ProjectPath)) { return $findings }
    $name = Split-Path $ProjectPath -Leaf

    # An import that resolves to nothing loads nothing, silently, and every check upstream of this
    # one reported the project healthy while it happened. Cheapest and highest-value check here.
    $cm = Join-Path $ProjectPath 'CLAUDE.md'
    if (Test-Path $cm) {
        $dead = @()
        foreach ($line in ((Read-TextUtf8 $cm) -split "`r?`n")) {
            $m = [regex]::Match($line.Trim(), '^@([^\s]+\.md)$')
            if (-not $m.Success) { continue }
            if (-not (Test-Path (Join-Path $ProjectPath $m.Groups[1].Value))) { $dead += $m.Groups[1].Value }
        }
        if ($dead.Count) {
            $findings += @{
                Rule = 'a document this session loads does not exist'
                What = ("CLAUDE.md imports " + ($dead -join ', ') + ", and nothing is there.")
                Fix  = 'Delete the import line, or restore the document. An unresolved import fails silently.'
            }
        }
    }

    # A warm start written every session and imported by none is a file nobody opens, which is
    # indistinguishable from not having written it. The studio was in that state for two days.
    $warm = Join-Path $ProjectPath 'WARM_START.md'
    if (Test-Path $warm) {
        $imports = (Test-Path $cm) -and ((Read-TextUtf8 $cm) -match '@[^\r\n]*WARM_START\.md')
        if (-not $imports) {
            $findings += @{
                Rule = 'state is written and never read'
                What = 'WARM_START.md exists and no CLAUDE.md imports it, so no session loads it.'
                Fix  = "Add a line reading '@WARM_START.md' to $name's CLAUDE.md."
            }
        }
    }

    # A reading that has never been taken, on a project old enough to have sold something. The
    # threshold is deliberately generous: this fires once a project is a month past its last
    # reading, not on a project that started last week, because a check that greets every new
    # project with a complaint is one people learn to scroll past.
    $wow = Join-Path $ProjectPath 'WAYS_OF_WORKING.md'
    if (Test-Path $wow) {
        $inTable = $false; $last = $null; $rows = 0
        foreach ($l in (Get-Content $wow -ErrorAction SilentlyContinue)) {
            if ($l -match '^\s*\|.*\bRead\b.*\bPeriod\b') { $inTable = $true; continue }
            if ($inTable) {
                if ($l -match '^\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|') {
                    $rows++
                    $d = [datetime]$matches[1]
                    if ($null -eq $last -or $d -gt $last) { $last = $d }
                } elseif ($l -notmatch '^\s*\|') { $inTable = $false }
            }
        }
        # An EMPTY table is a standing accusation and is reported. A MISSING table is invisible,
        # and this deliberately does not invent one: a project that keeps no reading table has
        # not opted into the rule, and inventing the obligation here would fire on every project
        # at once, which is the noise failure mode the measure names.
        # CUT BY ITS OWN MEASURE, before it shipped, and the reasoning is kept because the
        # temptation to add it back will recur. "This project has never had a reading" was in here
        # and was TRUE of five of the nine projects, so five of every nine sessions would have
        # opened with the identical sentence, forever, until somebody acted. That is the noise mode
        # the measure names, and it is precisely how the REALITY line already earned its place on
        # the list of things nine projects scroll past.
        #
        # It also fails the other test that matters here: the session cannot fix it. A reading needs
        # the founder's numbers. A brief that greets a session with work it cannot do is training
        # people to ignore the brief. That finding belongs in -Doctor, where it already is, and in
        # wind-down, where somebody is deciding what to do next.
        #
        # What survives is the CHANGE: a project that took readings and then stopped. Rare, real,
        # and a genuine signal rather than a standing condition.
        if ($last -and ((Get-Date) - $last).Days -gt 35) {
            $findings += @{
                Rule = 'the last reading is over a month old'
                What = ('Last read ' + $last.ToString('yyyy-MM-dd') + ', ' + ((Get-Date) - $last).Days + ' days ago.')
                Fix  = 'Run /reality-check here before deciding what to build next.'
            }
        }
    }

    $findings
}

# --------------------------------------------------------------- hook observability

# WARM_START has carried this line for weeks: "The autoload hook has never been observed firing.
# It is registered and exits silently when nothing has changed, which is indistinguishable from
# not running at all." That is a check nobody has watched fail, one level up: the MECHANISM every
# other guard here depends on has never been proved to run.
#
# So every hook entry point records that it fired. One line, appended, never read by the tool
# itself. It is the only way to answer "did it run" without changing what the hook does, and it is
# what makes the measure on the slip check countable rather than a matter of impression.
#
# Deliberately in the studio root and gitignored. It is machine-local evidence, not project state,
# and it must never become a file anyone feels obliged to tidy.
function Write-HookLog ([string]$Event, [string]$Detail) {
    try {
        $line = ((Get-Date).ToString('s') + "  " + $Event + "  " + $Detail)
        Add-Content -Path (Join-Path $StudioRoot '.studio-hooks.log') -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch { }
}


# --------------------------------------------------------------- resume prompt

# The resume prompt is the most valuable thing in a project's state document and the most often
# wrong, because nothing reads it between wind-downs. The studio's own said to expect 308
# assertions when the suite reported 360, and named a next action that had shipped two days
# earlier. A founder who opens the file and copies it does not verify it; nobody does.
#
# So the session start hands it over automatically: the whole prompt, verbatim, rather than a
# summary, because the alternative depends on somebody remembering, and not remembering is exactly
# how it went stale in the first place.
#
# Verbatim is deliberate. This does not rewrite the prompt or correct it in passing: the founder
# should see what the record actually says. A wind-down is what updates that record, written from
# a reading of the whole session, and a session start that quietly amends it has done no work yet.
# THE AUDIENCE SPLIT, ruled by the CEO on ST-069. This used to be Get-ResumePrompt, and the hook
# read the whole resume prompt out loud at every session start. Measured 2026-08-30 that was 74
# lines and 754 words; measured 2026-08-31, after ONE wind-down, it was 96 lines and 977 words. It
# grew 22 lines in a day, because every wind-down has a reason to add to the handover and none has
# a reason to cut. The CEO's words: "it just gives me this massive verbose message, but I only
# care about what."
#
# The prompt was also DUPLICATION. Measured across the population rather than assumed (S67): 4 of
# the 5 projects holding a CLAUDE.md import WARM_START.md directly, so the session already had the
# whole prompt on every request, and the fifth has no WARM_START.md at all so this produced nothing
# for it either way. The hook was paying 96 lines of the founder's attention to deliver something
# the session already had.
#
# So the hook now carries FOUNDER text only, and the session gets its manual by the import that was
# always loading it. Two audiences, two strings, two routes. FOUNDER-FACING AND SESSION-FACING TEXT
# MUST NEVER BE THE SAME STRING, and tools\check-session-brief.js asserts exactly that against this
# document, because as a style note it would lose to the same gradient that grew the prompt.
#
# The one case removing the read-out could have broken is already covered: Get-ProjectBrief above
# reports a WARM_START.md that no CLAUDE.md imports, as a single line naming the fix.
function Get-FounderBrief ([string]$ProjectPath) {
    $warm = Join-Path $ProjectPath 'WARM_START.md'
    if (-not (Test-Path $warm)) { return $null }
    $text = Read-TextUtf8 $warm

    # The heading wording varies by project, so match the intent rather than one exact string.
    # CASE-INSENSITIVE, and the `i` is not decoration. Written first as (?ms), it looked correct
    # and returned nothing against a real heading of "## Founder brief", so the hook emitted an
    # EMPTY message. The predecessor got away with (?ms) only because "resume" happens to be
    # lowercase inside "Prompt to resume this session". Caught by measuring the hook's output
    # rather than by reading this line, and an empty hook payload is indistinguishable from a
    # healthy silent one, which is the same shape as the studio's own rule about empty test output.
    # ANY heading level, not '##' alone. The checker blessed a '### Founder brief' that this
    # function could not read, so a project could pass its wind-down and still emit nothing at
    # session start. Two instruments disagreeing about the same document is the ST-055 shape:
    # a claim true where it was measured and false where the reader lives.
    $lines = $text -split "`r?`n"
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '(?i)^#{1,6}\s+[^\r\n]*founder brief') { $start = $i; break }
    }
    if ($start -lt 0) { return $null }

    # The brief is the first fenced block under that heading, and the search is BOUNDED TO THIS
    # SECTION. The bound is the whole defect, not tidiness. Without it the fence search runs to
    # end of file, so a "## Founder brief" heading followed by PROSE picks up the next section's
    # fence, which is the resume prompt, and the hook hands over 42 lines of session manual under
    # the label FOUNDER BRIEF. That is the 96-line defect this ticket exists to fix, returning
    # through its own new code path with a new name. Found by qa-tester at the ST-069 gate, and it
    # was reachable precisely because six other projects are about to be told to add this section.
    #
    # A HEADING IS NOT THE ONLY THING THAT ENDS A SECTION, and the first fix here assumed it was.
    # Markdown also ends one with a horizontal rule or a setext underline, and THIS DOCUMENT puts
    # a '---' immediately after the founder brief. So the same 42-line paste came back a second
    # time through the same code path, measured live at the round-two gate. Rules end the section
    # too.
    #
    # WHY THIS WALKS LINES INSTEAD OF TRUNCATING AT THE BOUND. Cutting the text at the first rule
    # would break a brief that legitimately CONTAINS a '---' line, because the cut would land
    # inside its fence and leave the fence unterminated, and the hook would emit nothing at all.
    # Silence is indistinguishable from health here, which is the failure this file already
    # records one level up. So a fence that has OPENED wins: inside it, a rule is content.
    $FENCE = [string][char]96 + [char]96 + [char]96
    $body = New-Object System.Collections.Generic.List[string]
    $inFence = $false
    for ($j = $start + 1; $j -lt $lines.Count; $j++) {
        $line = $lines[$j]
        if (-not $inFence) {
            if ($line.TrimStart().StartsWith($FENCE)) { $inFence = $true; continue }
            if ($line -match '^#{1,6}\s+\S') { return $null }
            if ($line -match '^\s{0,3}(-{3,}|\*{3,}|_{3,}|={3,})\s*$') { return $null }
            # A SETEXT UNDERLINE IS SHORTER THAN A RULE, and the line above claims to cover it
            # while requiring three characters. CommonMark allows an underline of ANY length from
            # one, so '-' and '==' under a paragraph end that section and match nothing above.
            # Measured at the round-three gate: a section titled by a TWO-DASH underline handed
            # the next block to the founder labelled FOUNDER BRIEF. It counts only DIRECTLY under
            # a non-blank line, which is what makes it an underline rather than stray dashes.
            if (($line -match '^\s{0,3}(=+|-+)\s*$') -and ($lines[$j - 1].Trim() -ne '')) { return $null }
            continue
        }
        if ($line.TrimStart().StartsWith($FENCE)) {
            $found = ($body -join "`n").Trim()
            if (-not $found) { return $null }
            return $found
        }
        $body.Add($line) | Out-Null
    }
    return $null
}

# --------------------------------------------------------------- recall

# Compaction is the one event that fires exactly when context is being dropped, which makes it the
# right moment to re-state the rules rather than a timer that mostly fires when nothing is
# happening. The CONTENT lives in base\governance\SESSION_RECALL.md and is not published; this only
# reads it, so nothing unproven ships to the export while the mechanism is still being tried.
function Invoke-Recall {
    $doc = Join-Path $GOV_BASE 'SESSION_RECALL.md'
    Write-HookLog 'recall' $(if (Test-Path $doc) { 'ok' } else { 'no governance' })
    if (-not (Test-Path $doc)) {
        # The public-export case, and it says so rather than printing nothing. A user whose install
        # carries no governance would otherwise see a hook that runs and does nothing, which is the
        # same silence this whole file exists to remove.
        @{
            systemMessage  = ("Studio recall: this install carries no base" + [char]92 + "governance" + [char]92 +
                              "SESSION_RECALL.md, so there are no standing rules to restate. Write your own there, " +
                              "or unregister the PreCompact hook.")
            suppressOutput = $true
        } | ConvertTo-Json -Compress
        return
    }
    $text = Read-TextUtf8 $doc
    # Only the two sections a session needs re-stated. The rest of the document explains WHY, which
    # is for a person reading the file and is exactly the sort of length that stops a block being
    # read at all.
    $keep = @()
    $on = $false
    foreach ($line in ($text -split "`r?`n")) {
        if ($line -match '^##\s+What is re-stated')            { $on = $true;  continue }
        if ($line -match '^##\s+The slip check')                { $on = $false; continue }
        if ($line -match '^---\s*$')                            { continue }
        if ($on) { $keep += $line }
    }
    $block = (($keep -join "`n") -replace "`n{3,}", "`n`n").Trim()
    @{ systemMessage = ("STUDIO RECALL, context was just compacted." + "`n`n" + $block); suppressOutput = $true } |
        ConvertTo-Json -Compress
}

# --------------------------------------------------------------- autoload

# Fast path for the SessionStart hook. Finds the project containing $Path, rebuilds its
# composed roster only if the base has moved, and stays silent when nothing is needed.
# The project a path belongs to: the nearest folder at or above it that a person would call a
# project. Deliberately NOT the overlay walk below, which stops at the folder holding overlays and
# therefore cannot see a project that has none.
function Resolve-OwningProject ([string]$Path) {
    $cur = $Path
    while ($cur) {
        if ((Test-Path (Join-Path $cur 'CLAUDE.md')) -or (Test-Path (Join-Path $cur '.git'))) { return $cur }
        $parent = Split-Path $cur -Parent
        if (-not $parent -or $parent -eq $cur -or $parent -eq $ProjectsRoot) { return $null }
        $cur = $parent
    }
    $null
}

function Invoke-Autoload ([string]$Path) {
    $dir = if ($Path) { $Path } else { (Get-Location).Path }
    $cur = $dir
    while ($cur -and $cur -ne (Split-Path $cur -Parent)) {
        if (Test-Path (Join-Path $cur $OVERLAY_DIR)) { break }
        $parent = Split-Path $cur -Parent
        if ($parent -eq $ProjectsRoot -or $parent -eq $cur) { $cur = $null; break }
        $cur = $parent
    }
    if (-not $cur -or -not (Test-Path (Join-Path $cur $OVERLAY_DIR))) { return $null }

    $agDir = Join-Path $cur $AGENT_DIR
    $manPath = Join-Path $agDir '.sync-manifest.json'
    $needs = $true
    if (Test-Path $manPath) {
        $needs = $false
        $man = Get-Content $manPath -Raw | ConvertFrom-Json
        foreach ($f in (Get-ChildItem $AGENT_BASE -Filter *.md -File)) {
            $rec = $man.PSObject.Properties[$f.BaseName]
            # Either hash form counts as current, exactly as -Status does. The manifest now holds
            # the expanded-text hash; accepting only the file hash here would make this hook
            # decide every project needed rebuilding on every session start, forever.
            if (-not $rec) { $needs = $true; break }
            if ($rec.Value.base -ne (Get-Sha $f.FullName) -and $rec.Value.base -ne (Get-TextSha (Get-AgentText $f.FullName))) { $needs = $true; break }
        }
        if (-not $needs) {
            foreach ($ov in (Get-ChildItem (Join-Path $cur $OVERLAY_DIR) -Filter *.md -File)) {
                if ($ov.LastWriteTime -gt (Get-Item $manPath).LastWriteTime) { $needs = $true; break }
            }
        }
    }
    if (-not $needs) { return $null }
    # Build-Project returns early for the studio, so without this the hook announces a rebuild
    # that did not happen. A false "rebuilt" is worse than silence: it is the reassurance that
    # stops someone checking.
    if (Test-IsInStudio $cur) { return $null }
    Build-Project $cur -Quiet -Silent
    # Returns the sentence rather than printing it. The dispatch owns the one write to stdout, so
    # the rebuild line and the session brief cannot arrive as two competing JSON documents.
    "Studio agents rebuilt for $(Split-Path $cur -Leaf) from base $(Get-StudioVersion)."
}

# --------------------------------------------------------------- connect

# Writes a delimited pointer block into a project's CLAUDE.md so any session opened there
# knows the roster is generated and where the real source is. Idempotent: the markers let
# it be rewritten in place rather than accumulating copies.
function Connect-Project ([string]$ProjectPath) {
    # Reported as a residual on ST-007 and again by the reviewer as a published false claim:
    # -Connect -Project aimed at the studio resolved and wrote a self-referential pointer block
    # into the studio's own CLAUDE.md, instructing the reader to run -Compose on it, which
    # refuses. Guidance that contradicts the tool is worse than none.
    Assert-Writable $ProjectPath '-Connect'
    $name  = Split-Path $ProjectPath -Leaf
    $rel   = $ProjectPath.Replace("$ProjectsRoot\", '')
    $studioRel = $StudioRoot.Replace("$ProjectsRoot\", '')
    $begin = '<!-- STUDIO:BEGIN -->'
    $end   = '<!-- STUDIO:END -->'

    $block = @"
$begin
## Agent team and shared governance

The agent team for this project is produced by the studio at ``$studioRel``. It is shared
across every project, so a change made in the right place improves all of them at once.

**Never hand-edit ``.claude/agents/`` in this project.** Those files are generated and are
rebuilt from scratch on the next compose, so an edit there is live in your session,
invisible to every other project, and then silently destroyed.

- Improve a role for EVERY project: edit ``$studioRel\base\agents\<role>.md``, written
  stack-neutral, then run ``$studioRel\studio.ps1 -Sync``.
- Tune a role for THIS project only: edit ``.claude\agent-overlays\_project.md`` for
  something every role should know, or ``.claude\agent-overlays\<role>.md`` for one role,
  then run ``$studioRel\studio.ps1 -Compose -Project "$rel"``.
- The routing test: would a project on a different stack benefit? Yes means the base, no
  means the overlay.

``$studioRel\METHOD.md`` is the full model. ``studio.ps1 -Doctor`` reports what has drifted
anywhere in the studio and the command that fixes it.
$end
"@

    $file = Join-Path $ProjectPath 'CLAUDE.md'
    if (Test-Path $file) {
        $c = Read-TextUtf8 $file
        if ($c -match [regex]::Escape($begin)) {
            $pattern = [regex]::Escape($begin) + '[\s\S]*?' + [regex]::Escape($end)
            $new = [regex]::Replace($c, $pattern, $block.Replace('$','$$'))
            if ($new -eq $c) { return 'current' }
            if (-not $WhatIf) { Write-Utf8NoBom $file $new }
            return 'updated'
        }
        if (-not $WhatIf) { Write-Utf8NoBom $file ($c.TrimEnd() + "`r`n`r`n" + $block + "`r`n") }
        return 'appended'
    }
    if (-not $WhatIf) { Write-Utf8NoBom $file ("# $name`r`n`r`n" + $block + "`r`n") }
    return 'created'
}

# Folders a session has actually been opened in. These matter most, because that is where
# Claude Code looks for .claude/agents, and a card placed anywhere else never loads.
function Get-SessionFolders {
    $dir = Join-Path $env:USERPROFILE '.claude\projects'
    if (-not (Test-Path $dir)) { return @() }
    $out = @()
    foreach ($d in (Get-ChildItem $dir -Directory -EA SilentlyContinue)) {
        foreach ($cand in (Find-Projects)) {
            # Claude Code names its project folders after the cwd with separators flattened.
            # Derive the prefix from the home path rather than assuming a Windows layout.
            $homePrefix = $env:USERPROFILE -replace '[:\\/]', '-'
            $key = $homePrefix + '-' + $cand.Replace($env:USERPROFILE + [IO.Path]::DirectorySeparatorChar, '').Replace('\', '-').Replace('/', '-').Replace(' ', '-')
            if ($d.Name -eq $key) { $out += $cand }
        }
    }
    $out | Sort-Object -Unique
}


# What a session in this project actually loads before it can do anything. Claude Code refuses to
# quietly load any single @-imported document over 150,000 characters and warns at session start,
# and the total across all of them is context spent before a word of work happens.
#
# NOTHING MEASURED THIS. Two projects were already over the limit when it was first checked, and
# the second one had been over for an unknown length of time with nobody aware, because the only
# thing that reports it is Claude Code itself and only to a session that happens to open there.
# That is the ST-016 shape once more: the thing that knows is not the thing that could act.
#
# It is the studio's problem rather than each project's. The scaffold creates these documents, the
# wind-down skill appends to them every session, and the append-only rule is ours, so every
# project is on this curve by construction.
# Taken from the warning text Claude Code shows, not measured here and not documented in this
# repository. What was OBSERVED: a session opened where one imported document was 160,893
# characters, and the tool warned. Everything past this line is therefore a threshold we chose to
# report at, close to where the tool is known to complain, rather than a boundary we can prove.
# If the tool changes it, this is the one line to correct.
$CONTEXT_FILE_LIMIT = 150000
function Get-LoadedContext ([string]$ProjectPath) {
    $cm = Join-Path $ProjectPath 'CLAUDE.md'
    if (-not (Test-Path $cm)) { return $null }
    $text = Read-TextUtf8 $cm
    $files = @([pscustomobject]@{ Name = 'CLAUDE.md'; Chars = $text.Length })
    foreach ($line in ($text -split "`r?`n")) {
        $m = [regex]::Match($line.Trim(), '^@([^\s]+\.md)$')
        if (-not $m.Success) { continue }
        $rel = $m.Groups[1].Value
        $p = Join-Path $ProjectPath $rel
        # A missing import is already reported by the DEAD check; here it simply loads nothing.
        $n = if (Test-Path $p) { (Read-TextUtf8 $p).Length } else { 0 }
        $files += [pscustomobject]@{ Name = $rel; Chars = $n }
    }
    [pscustomobject]@{
        Total = ($files | Measure-Object -Property Chars -Sum).Sum
        Files = $files
        Over  = @($files | Where-Object { $_.Chars -gt $CONTEXT_FILE_LIMIT })
    }
}

# --------------------------------------------------------------- reporting

# A project can write its state faithfully at the end of every session and still never read
# it back, because CLAUDE.md is the only file a session loads automatically. If WARM_START.md
# is not imported from there it is a file nobody opens, which is indistinguishable from not
# having written it. The studio itself was in exactly that state for two days.
function Get-StateDocStatus ([string]$ProjectPath) {
    $skip = '\\node_modules\\|\\\.archive\\|\\\.git\\|\\\.public\\|\\\.publish-work\\|\\new-project\\'

    $warm = Get-ChildItem $ProjectPath -Filter 'WARM_START.md' -Recurse -Depth 2 -File -EA SilentlyContinue |
            Where-Object { $_.FullName -notmatch $skip } | Select-Object -First 1
    if (-not $warm) { return [pscustomobject]@{ State='missing'; Detail='no WARM_START.md, this project keeps no state' } }

    # The import only resolves relative to the CLAUDE.md that declares it, so the one that
    # matters is beside the warm start, or at the project root reaching down to it.
    $claudes = @(
        (Join-Path $warm.DirectoryName 'CLAUDE.md')
        (Join-Path $ProjectPath 'CLAUDE.md')
    ) | Where-Object { Test-Path $_ } | Select-Object -Unique

    if (-not $claudes.Count) { return [pscustomobject]@{ State='orphan'; Detail='WARM_START.md exists but there is no CLAUDE.md to load it' } }

    foreach ($c in $claudes) {
        if ((Get-Content $c -Raw -EA SilentlyContinue) -match '@[^\r\n]*WARM_START\.md') {
            return [pscustomobject]@{ State='ok'; Detail=$warm.FullName.Replace("$ProjectsRoot\", '') }
        }
    }
    [pscustomobject]@{ State='unread'; Detail='WARM_START.md is written but no CLAUDE.md imports it, so no session reads it' }
}

function Show-Status ([switch]$Fix) {
    $agents = Get-BaseAgents
    # Every section below reports on this as well as on the projects. Resolved once, at the
    # top, so a section cannot quietly drop off the list by being moved above where it used
    # to be set.
    $self   = Get-StudioSelf
    Write-Host ""
    Write-Host "STUDIO" -ForegroundColor Cyan
    Write-Host "  base roster     $($agents.Count) roles   $AGENT_BASE"
    Write-Host "  base governance $($SHARED_GOV.Count) files   $GOV_BASE"
    $skillCount = if (Test-Path $SKILL_BASE) { (Get-ChildItem $SKILL_BASE -Directory).Count } else { 0 }
    $skillsInstalled = if (Test-Path (Join-Path $env:USERPROFILE '.claude\skills')) { (Get-ChildItem (Join-Path $env:USERPROFILE '.claude\skills') -Directory -EA SilentlyContinue).Count } else { 0 }
    # COUNTS are not contents. This line reported "3 installed" while the installed /assess was
    # 27 bytes and nine em dashes different from its source, because it was installed before a
    # content fix and nothing re-synced. The roster has drift detection and skills had none, so
    # the number agreed while the files did not.
    $skillStale = @()
    if (Test-Path $SKILL_BASE) {
        foreach ($sk in (Get-ChildItem $SKILL_BASE -Directory)) {
            $src = Join-Path $sk.FullName 'SKILL.md'
            $dst = Join-Path $env:USERPROFILE (".claude\skills\" + $sk.Name + "\SKILL.md")
            if (-not (Test-Path $src)) { continue }
            if (-not (Test-Path $dst)) { $skillStale += ($sk.Name + " (not installed)"); continue }
            if ((Get-FileTextSha $src) -ne (Get-FileTextSha $dst)) { $skillStale += $sk.Name }
        }
    }
    Write-Host ("  base skills     {0} skill(s), {1} installed   {2}" -f $skillCount, $skillsInstalled, $SKILL_BASE)
    if ($skillStale.Count) {
        Write-Host ("                  STALE: {0}. the installed copy differs from base. Safe: -Sync" -f ($skillStale -join ', ')) -ForegroundColor Yellow
    }

    # A base/install difference has two opposite causes and only one is dangerous. Classify
    # it against the install manifest rather than reporting "drift" and leaving the reader
    # to guess, because the wrong guess here is destructive in both directions: syncing over
    # a hand-edited install destroys the edit, and promoting a stale install to the base
    # reverts everyone.
    $g = Join-Path $env:USERPROFILE '.claude\agents'
    $man = Read-InstallManifest $g
    $missing=@(); $behind=@(); $edited=@(); $unknown=@(); $unexpandable=@()
    foreach ($f in $agents) {
        $d = Join-Path $g $f.Name
        if (-not (Test-Path $d)) { $missing += $f.BaseName; continue }
        # Compare EXPANDED text on both sides. Comparing the installed file (fragments
        # resolved) against the base source (still holding the marker) can never match, so
        # every role reported out of date forever and -Sync could not satisfy it.
        $bt = Get-AgentTextOrNull $f.FullName
        if ($null -eq $bt) { $unexpandable += $f.BaseName; continue }
        $dh = Get-FileTextSha $d; $bh = Get-TextSha $bt
        if ($dh -eq $bh) { continue }
        # Conditional on the base role carrying no marker. Before fragments existed the install
        # WAS a byte copy of the source, and treating that as current is right. The moment a
        # source carries {{include:}}, a byte-identical install is not a legacy install: it is an
        # install holding a literal marker where a rule should be. This line reported that as
        # "out of date 0". An exemption has to be conditional on the fact that justified it.
        if ((Get-FragmentRefs $f.FullName).Count -eq 0 -and (Get-Sha $d) -eq (Get-Sha $f.FullName)) { continue }
        $rec = $man[$f.BaseName]
        if (-not $rec)        { $unknown += $f.BaseName }
        elseif ($dh -eq $rec) { $behind  += $f.BaseName }
        else                  { $edited  += $f.BaseName }
    }
    $off = $missing.Count + $behind.Count + $edited.Count + $unknown.Count
    Write-Host ""
    Write-Host "BASE INSTALL (used by untuned projects)" -ForegroundColor Cyan
    Write-Host ("  $g")
    Write-Host ("  missing {0}, out of date {1}, hand-edited {2}, unknown {3}" -f $missing.Count, $behind.Count, $edited.Count, $unknown.Count) -ForegroundColor $(if($off){'Yellow'}else{'Gray'})
    if ($behind.Count)  { Write-Host "  the BASE moved on and the install has not caught up. Safe: -Sync" -ForegroundColor Gray
                          Write-Host "    $($behind -join ', ')" -ForegroundColor Gray }
    if ($edited.Count)  { Write-Host "  the INSTALL was edited directly. Do NOT sync over it; that lesson exists nowhere else." -ForegroundColor Yellow
                          Write-Host "  promote the change into base\agents first, then -Sync." -ForegroundColor Yellow
                          Write-Host "    $($edited -join ', ')" -ForegroundColor Yellow }
    if ($unknown.Count) { Write-Host "  differs, and no record of what it was installed from, so the direction is unknown." -ForegroundColor Yellow
                          Write-Host "  diff it against base\agents before syncing. -Sync records the answer for next time." -ForegroundColor Yellow
                          Write-Host "    $($unknown -join ', ')" -ForegroundColor Yellow }
    if ($unexpandable.Count) { Write-Host ("  CANNOT EXPAND {0} role(s): a fragment they include is missing, empty or malformed." -f $unexpandable.Count) -ForegroundColor Red
                               Write-Host "  -Sync will refuse until that is fixed. FRAGMENTS below names it." -ForegroundColor Red
                               Write-Host "    $($unexpandable -join ', ')" -ForegroundColor Red }

    # Will these agents actually LOAD? Everything above only says the files are present and
    # match the base. That is not the same question, and the difference cost weeks.
    #
    # An agent file has to open with `---` at byte zero for its YAML frontmatter to parse. A
    # byte order mark in front of it means no frontmatter, so no name, so the agent is never
    # registered. It is on disk, it matches the base, and it does not exist. Thirteen of
    # sixteen roles were absent from every project while this section printed all clear.
    #
    # So the check is not "is the file right", it is "can it be loaded".
    Write-Host ""
    Write-Host "LOADABLE" -ForegroundColor Cyan
    $unloadable = @()
    # The studio's own agent folder is included even though it should never have one. If a
    # hand-placed agent ever appears there it is exactly as unloadable as anywhere else, and
    # the studio was previously the one place this check could not see.
    foreach ($dir in @($g) + @((Join-Path $self.Path $AGENT_DIR)) + @(Find-Projects | ForEach-Object { Join-Path $_ $AGENT_DIR })) {
        if (-not (Test-Path $dir)) { continue }
        foreach ($f in (Get-ChildItem $dir -Filter *.md -File -ErrorAction SilentlyContinue)) {
            $b = [System.IO.File]::ReadAllBytes($f.FullName) | Select-Object -First 3
            if ($b.Count -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) {
                $unloadable += "$($f.BaseName)  ($dir)  byte order mark"
                continue
            }
            # Actually PARSE it. This check reported "every composed agent opens with parseable
            # frontmatter" while only ever looking at three bytes, so an agent whose header never
            # closed, or that carried an unresolved marker inside the header, was called parseable
            # by a check that had not parsed anything. A claim from a check that never performed
            # the thing it claims is the defect this whole section exists to catch.
            $txt = Read-TextUtf8 $f.FullName
            $ls  = $txt -split "`r?`n"
            if ($ls.Count -lt 2 -or $ls[0].Trim() -ne '---') {
                $unloadable += "$($f.BaseName)  ($dir)  no frontmatter block"
                continue
            }
            $closed = $false
            for ($n = 1; $n -lt $ls.Count; $n++) {
                if ($ls[$n].Trim() -eq '---') { $closed = $true; break }
                if ($ls[$n] -match '(?i)\{\{\s*include') {
                    $unloadable += "$($f.BaseName)  ($dir)  unresolved fragment marker in the header"
                    $closed = $true
                    break
                }
            }
            if (-not $closed) { $unloadable += "$($f.BaseName)  ($dir)  frontmatter never closes" }
        }
    }
    if ($unloadable.Count) {
        # Cause-neutral headline and remedy. This check now finds four faults and the headline
        # named only the first, so a file with an unresolved marker in its header was reported
        # as beginning with a byte order mark, and the fix line told you to strip a mark that
        # was not there. Each row below names its own cause; the header must not contradict it.
        Write-Host ("  {0} agent file(s) WILL NOT LOAD" -f $unloadable.Count) -ForegroundColor Red
        Write-Host "  their frontmatter cannot parse, so they are composed, current, and absent from the session." -ForegroundColor Red
        $unloadable | Select-Object -First 12 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        if ($unloadable.Count -gt 12) { Write-Host ("    ... and {0} more" -f ($unloadable.Count - 12)) -ForegroundColor Red }
        Write-Host "  fix: correct the cause named on each row in base\agents, then -Sync -Force. Writers must use Write-Utf8NoBom." -ForegroundColor Red
    } else {
        Write-Host "  every composed agent opens with parseable frontmatter" -ForegroundColor Green
    }

    # A fragment nobody includes is a rule that has quietly stopped applying to anyone, and it
    # looks identical on disk to one that applies everywhere. A fragment a role asks for and
    # that does not exist stops the build, so it is reported here BEFORE someone hits it mid-sync.
    # A control byte does not stop a file parsing, does not stop an agent registering, and is
    # invisible in every diff and review tool. It sits in the middle of a rule. Seven have been
    # written into this repository in one session, every one from a Windows path passed through
    # a patch script where backslash-a or backslash-f is an escape. Each was found by accident;
    # one only because a comment split in half and the script stopped parsing.
    #
    # Tab, newline and carriage return are legitimate. Nothing else below 0x20 is.
    Write-Host ""
    Write-Host "BYTES" -ForegroundColor Cyan
    $scanRoots = $PUBLISHED_TREES
    $dirty = @(Get-ControlByteHits ($scanRoots | ForEach-Object { Join-Path $StudioRoot $_ }) $StudioRoot)
    if ($dirty.Count) {
        foreach ($d in $dirty) { Write-Host ("  CONTROL BYTE  {0}" -f $d) -ForegroundColor Red }
        Write-Host "  these publish. a stray byte here sits inside a rule and shows in no diff." -ForegroundColor Red
    } else {
        Write-Host ("  clean, no stray control bytes in {0} published trees" -f $scanRoots.Count) -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "FRAGMENTS" -ForegroundColor Cyan
    $fragDir = Join-Path $StudioRoot 'base\fragments'
    if (-not (Test-Path $fragDir)) {
        Write-Host "  none. Rules shared by every role are still copied by hand into each file." -ForegroundColor DarkGray
    } else {
        $frags = @(Get-ChildItem $fragDir -Filter *.md -File -ErrorAction SilentlyContinue)
        $used  = @{}
        $broken = @()
        $malformed = @()
        foreach ($a in $agents) {
            foreach ($r in (Get-FragmentRefs $a.FullName)) {
                if (-not $used.ContainsKey($r)) { $used[$r] = @() }
                $used[$r] += $a.BaseName
                # A name the EXPANDER would reject is a typo, not a reference to a fragment that
                # is missing. Reported separately because the two read completely differently to
                # someone fixing it, and because the fragment the author MEANT then appears in the
                # list above as UNUSED, which says "this rule applies to nobody" when the truth is
                # a stray '.md'.
                if ($r -notmatch '^[A-Za-z0-9_-]+$') { $malformed += "$($a.BaseName) -> $r" }
                elseif (-not (Test-Path (Get-FragmentPath $r))) { $broken += "$($a.BaseName) -> $r" }
            }
        }
        if (-not $frags.Count) {
            Write-Host "  the folder exists and is empty." -ForegroundColor DarkGray
        }
        foreach ($fr in $frags) {
            $n = $fr.BaseName
            # Distinct ROLES, not occurrences. Counting appends printed "included by 17 of 16
            # roles" the moment one role carried a marker twice, which is a number that cannot
            # be true and was reported without comment.
            $c = if ($used.ContainsKey($n)) { @($used[$n] | Sort-Object -Unique).Count } else { 0 }
            if ($c -eq 0) {
                Write-Host ("  UNUSED   {0}   no role includes it, so this rule applies to nobody" -f $n) -ForegroundColor Yellow
            } else {
                Write-Host ("  ok       {0}   included by {1} of {2} roles" -f $n, $c, $agents.Count) -ForegroundColor Gray
            }
        }
        foreach ($b in ($broken | Sort-Object -Unique)) {
            Write-Host ("  MISSING  {0}   the role asks for a fragment that is not there; -Sync will refuse" -f $b) -ForegroundColor Red
        }
        foreach ($m in ($malformed | Sort-Object -Unique)) {
            Write-Host ("  MALFORMED {0}   not a fragment name. Letters, digits, hyphen, underscore, no extension." -f $m) -ForegroundColor Red
            Write-Host "            -Compose refuses this, and the fragment it MEANT reads as UNUSED above." -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "PROJECTS" -ForegroundColor Cyan

    # Listed first and tagged, so it is obvious this row is the guardian and not a ninth
    # product. It carries no composed/current state because it is never composed.
    Write-Host ("  {0,-11} {1}" -f 'studio', $self.Name) -ForegroundColor Cyan
    Write-Host "      the studio itself. owns the base roster, so it is never composed from it." -ForegroundColor DarkGray
    if (Test-Path (Join-Path $self.Path $AGENT_DIR)) {
        Write-Host "      UNEXPECTED: it has a $AGENT_DIR folder. Nothing composes the studio, so that was hand-placed." -ForegroundColor Yellow
    }

    foreach ($p in Find-Projects) {
        $short   = $p.Replace("$ProjectsRoot\", '')
        $ovDir   = Join-Path $p $OVERLAY_DIR
        $agDir   = Join-Path $p $AGENT_DIR
        $govRoot = Get-GovRoot $p

        $tuned = Test-Path $ovDir
        $tag   = if ($tuned) { 'tuned' } elseif (Test-Path $agDir) { 'UNMANAGED' } else { 'base only' }
        $col   = if ($tag -eq 'UNMANAGED') { 'Yellow' } elseif ($tuned) { 'White' } else { 'Gray' }
        Write-Host ("  {0,-11} {1}" -f $tag, $short) -ForegroundColor $col

        if ($tag -eq 'UNMANAGED') { Write-Host "      hand-placed agents, no overlay. Forked, receives no base updates." -ForegroundColor Yellow }

        if ($tuned) {
            $man = if (Test-Path (Join-Path $agDir '.sync-manifest.json')) { Get-Content (Join-Path $agDir '.sync-manifest.json') -Raw | ConvertFrom-Json } else { $null }
            if (-not $man) { Write-Host "      never composed, run -Compose" -ForegroundColor Yellow }
            else {
                $stale = @(); $unbuildable = @()
                foreach ($f in $agents) {
                    $rec = $man.PSObject.Properties[$f.BaseName]
                    if (-not $rec) { continue }
                    # Both hash forms count as current: the file hash for a manifest written
                    # before fragments existed, the expanded-text hash for every one since.
                    # The text hash is the only one that moves when a FRAGMENT changes, which
                    # is why a project could report current while carrying an old rule.
                    $txt = Get-AgentTextOrNull $f.FullName
                    if ($null -eq $txt) { $unbuildable += $f.BaseName; continue }
                    if ($rec.Value.base -ne (Get-Sha $f.FullName) -and $rec.Value.base -ne (Get-TextSha $txt)) { $stale += $f.BaseName }
                }
                if ($unbuildable.Count) { Write-Host "      CANNOT COMPOSE ($($unbuildable.Count) roles): a fragment they include is missing, empty or malformed. See FRAGMENTS above." -ForegroundColor Red }
                elseif ($stale.Count) { Write-Host "      STALE vs base ($($stale.Count) roles), run -Compose" -ForegroundColor Yellow }
                else { Write-Host "      composed and current" -ForegroundColor Green }
            }
        }

        if ($govRoot) {
            $gd = @()
            foreach ($f in $SHARED_GOV) {
                $src = Join-Path $GOV_BASE $f; $dst = Join-Path $govRoot $f
                if ((Test-Path $src) -and (Get-Sha $src) -ne (Get-Sha $dst)) { $gd += $f }
            }
            if ($gd.Count) { Write-Host ("      governance drifted: {0}" -f ($gd -join ', ')) -ForegroundColor Yellow }
        }
    }

    # Does each project actually read its own state back? The studio is checked first, from
    # Get-StudioSelf rather than from Find-Projects, because the guardian should not be the
    # one thing nobody watches. This was the only section that already did so.
    Write-Host ""
    Write-Host "STATE DOCUMENTS" -ForegroundColor Cyan
    $stateTargets = @($self)
    foreach ($p in Find-Projects) { $stateTargets += [pscustomobject]@{ Name=$p.Replace("$ProjectsRoot\", ''); Path=$p } }

    $unread = 0
    foreach ($t in $stateTargets) {
        $s = Get-StateDocStatus $t.Path
        switch ($s.State) {
            'ok'      { Write-Host ("  ok       {0}" -f $t.Name) -ForegroundColor Gray }
            'missing' { Write-Host ("  none     {0}   {1}" -f $t.Name, $s.Detail) -ForegroundColor DarkGray }
            default   { $unread++; Write-Host ("  UNREAD   {0}   {1}" -f $t.Name, $s.Detail) -ForegroundColor Yellow }
        }
    }
    # Every @import must RESOLVE. The check above verifies a project imports WARM_START.md; it
    # never verified that the files a CLAUDE.md points at actually exist. One project imported a
    # document retired seventeen days earlier that was no longer on disk, and reported "ok" here
    # and "composed and current" in PROJECTS the whole time, because an unresolved import does
    # not error, it silently loads nothing. A second project was importing the same retired
    # document where it did still exist, which is worse: it was loading a retired file as
    # though it were current.
    #
    # The instances were one edit each. This is the half that matters, because the class recurs:
    # a document is retired at source, the scaffold is updated, and nothing sweeps the projects
    # that already had it.
    $deadImports = 0
    foreach ($t in $stateTargets) {
        $cm = Join-Path $t.Path 'CLAUDE.md'
        if (-not (Test-Path $cm)) { continue }
        $missing = @()
        foreach ($line in ((Read-TextUtf8 $cm) -split "`r?`n")) {
            $m = [regex]::Match($line.Trim(), '^@([^\s]+\.md)$')
            if (-not $m.Success) { continue }
            $rel = $m.Groups[1].Value
            if (-not (Test-Path (Join-Path $t.Path $rel))) { $missing += $rel }
        }
        if ($missing.Count) {
            $deadImports += $missing.Count
            Write-Host ("  DEAD     {0}   imports that do not exist: {1}" -f $t.Name, ($missing -join ', ')) -ForegroundColor Red
        }
    }
    if ($deadImports) {
        Write-Host "  an import that resolves to nothing loads nothing, silently, and reports ok above." -ForegroundColor Red
    }
    if ($unread) {
        Write-Host "  a warm start nothing imports is written every session and read in none." -ForegroundColor Yellow
        Write-Host "  fix: add a line reading '@WARM_START.md' to that project's CLAUDE.md." -ForegroundColor Yellow
    }

    # When did anyone last check whether these projects actually work?
    #
    # A studio can be perfectly maintained, fully composed, every document current, and still
    # be six projects nobody has looked at the numbers for. One took real card payments for
    # six weeks while every session worked on the top of the funnel, and its whole record was
    # silent on whether it had sold anything. That is not carelessness, it is the default:
    # building is pleasant and looking is not, so nothing forces the look.
    #
    # This makes the silence visible. A DEFERRED row counts as looking, deliberately: the
    # founder was asked and said not now, which is an answer and is recorded as one.
    Write-Host ""
    Write-Host "CONTEXT (what a session loads before it starts)" -ForegroundColor Cyan
    $ctxOver = 0; $ctxNear = 0; $ctxFloor = 0; $ctxFloorName = ''
    foreach ($t in $stateTargets) {
        $ctx = Get-LoadedContext $t.Path
        if (-not $ctx) { continue }
        $k = [math]::Round($ctx.Total / 1000)
        if ($ctx.Total -gt $ctxFloor) { $ctxFloor = $ctx.Total; $ctxFloorName = $t.Name }
        if ($ctx.Over.Count) {
            $ctxOver++
            $worst = ($ctx.Over | Sort-Object Chars -Descending | Select-Object -First 1)
            Write-Host ("  OVER     {0,-38} {1,5}k loaded   {2} is {3}k, past the {4}k limit" -f `
                $t.Name, $k, $worst.Name, [math]::Round($worst.Chars/1000), [math]::Round($CONTEXT_FILE_LIMIT/1000)) -ForegroundColor Red
        } else {
            # The per-file limit is the hard one, but a project whose largest document is most of
            # the way there is worth naming while there is still time to act deliberately.
            $big = @($ctx.Files | Where-Object { $_.Chars -gt ($CONTEXT_FILE_LIMIT * 0.6) })
            if ($big.Count) {
                $ctxNear++
                $b = ($big | Sort-Object Chars -Descending | Select-Object -First 1)
                Write-Host ("  near     {0,-38} {1,5}k loaded   {2} is {3}k" -f `
                    $t.Name, $k, $b.Name, [math]::Round($b.Chars/1000)) -ForegroundColor Yellow
            } elseif ($ctx.Total -gt $CONTEXT_FILE_LIMIT) {
                # No single file trips the tool's warning and the total is still past what the
                # tool considers too much for ONE document. Reported because the first version of
                # this check called a project loading 195k "ok" purely because it had spread the
                # weight over several files, which is the same cost and no warning at all.
                $ctxNear++
                Write-Host ("  watch    {0,-38} {1,5}k loaded   spread across {2} files, none over the limit" -f `
                    $t.Name, $k, $ctx.Files.Count) -ForegroundColor Yellow
            } else {
                Write-Host ("  ok       {0,-38} {1,5}k loaded" -f $t.Name, $k) -ForegroundColor Gray
            }
        }
    }
    # THE FLOOR, REPORTED AS A RUNNING COST RATHER THAN A SIZE.
    #
    # Everything above answers "how big is it", which is the question that let a real project
    # reach a 56k floor without anyone noticing. Size is not what is paid. Every request
    # re-sends the whole conversation, so the floor is charged AGAIN on every request of every
    # session and every agent, and the bill grows with the SQUARE of session length.
    #
    # The number that made this visible came from a founder's monthly budget running out, not
    # from any control here: 574 requests, 39.2M weighted input tokens, 115k of output. 340
    # tokens paid for every token produced, with no single file read over 5k. The floor alone
    # was 21 per cent of it, spent re-reading process documents before doing anything.
    #
    # Four characters per token is an approximation and is stated as one. It is close enough to
    # tell a 15k floor from a 56k one, which is the decision this line exists to inform.
    if ($ctxFloor) {
        $floorTok = [math]::Round($ctxFloor / 4000)
        Write-Host ""
        Write-Host ("  FLOOR    worst is {0} at ~{1}k tokens, charged on EVERY request" -f `
            $ctxFloorName, $floorTok) -ForegroundColor $(if ($floorTok -ge 40) { 'Red' } elseif ($floorTok -ge 20) { 'Yellow' } else { 'Gray' })
        foreach ($n in @(100, 200)) {
            Write-Host ("           over {0,3} requests that floor alone is ~{1,5}k tokens, before any work" -f `
                $n, ($floorTok * $n)) -ForegroundColor DarkGray
        }
        if ($floorTok -ge 20) {
            Write-Host "  the fix is not deleting history. Split each imported document into a current file" -ForegroundColor Yellow
            Write-Host "  that IS @-imported and an archive that is only pointed at. The audit trail stays" -ForegroundColor Yellow
            Write-Host "  whole and stops being re-read on every request." -ForegroundColor Yellow
        }
        Write-Host ""
    }
    if ($ctxOver) {
        Write-Host "  a document past the limit is not loaded quietly: the session opens with a warning," -ForegroundColor Red
        Write-Host "  and everything in it is context spent before any work begins." -ForegroundColor Red
        Write-Host "  fix: move older decisions into DECISIONS-ARCHIVE.md, which is NOT @-imported but is" -ForegroundColor Red
        Write-Host "  pointed at from the document that is. Nothing is deleted and the trail stays whole." -ForegroundColor Red
    } elseif ($ctxNear) {
        Write-Host "  nothing is past the per-file threshold. The rows above are worth acting on before" -ForegroundColor Yellow
        Write-Host "  they are, by moving older decisions out of what loads automatically." -ForegroundColor Yellow
        Write-Host "  Splitting one document into two changes nothing on its own: the total is what costs." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "REALITY" -ForegroundColor Cyan
    $overdue = 0; $never = 0
    # Includes the studio. A project with no WAYS_OF_WORKING.md is skipped below rather than
    # reported, so this adds no row today and starts reporting the day the studio keeps a
    # reading table, instead of silently never applying to the one project that owns the rule.
    foreach ($p in @($self.Path) + @(Find-Projects)) {
        $name = $p.Replace("$ProjectsRoot\", '')
        $root = Get-GovRoot $p
        if (-not $root) { $root = $p }
        $wow  = Join-Path $root 'WAYS_OF_WORKING.md'
        if (-not (Test-Path $wow)) { continue }
        $lines = Get-Content $wow -ErrorAction SilentlyContinue
        $inTable = $false; $last = $null
        foreach ($l in $lines) {
            if ($l -match '^\s*\|.*\bRead\b.*\bPeriod\b') { $inTable = $true; continue }
            if ($inTable) {
                if ($l -match '^\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|') {
                    $d = [datetime]$matches[1]
                    if ($null -eq $last -or $d -gt $last) { $last = $d }
                } elseif ($l -notmatch '^\s*\|') { $inTable = $false }
            }
        }
        if ($null -eq $last) {
            $never++
            Write-Host ("  never    {0}   no reading has ever been recorded" -f $name) -ForegroundColor Yellow
        } else {
            $age = [int]((Get-Date) - $last).TotalDays
            if ($age -gt 30) {
                $overdue++
                Write-Host ("  OVERDUE  {0}   last read {1}, {2} days ago" -f $name, $last.ToString('yyyy-MM-dd'), $age) -ForegroundColor Yellow
            } else {
                Write-Host ("  ok       {0}   last read {1}, {2} days ago" -f $name, $last.ToString('yyyy-MM-dd'), $age) -ForegroundColor Gray
            }
        }
    }
    if ($overdue -or $never) {
        Write-Host "  run /reality-check in that project's session BEFORE deciding what to build next." -ForegroundColor Yellow
        Write-Host "  declining is a valid answer and gets recorded; not asking is not." -ForegroundColor Yellow
    }

    # Every place the studio standard has been bent, in one view. Without this a register
    # is just somewhere deviations go to be forgotten.
    $allDevs = @()
    foreach ($p in Find-Projects) {
        foreach ($d in (Get-Deviations $p)) {
            $allDevs += [pscustomobject]@{ Project = $p.Replace("$ProjectsRoot\", ''); D = $d }
        }
    }
    Write-Host ""
    Write-Host "DEVIATION REGISTER" -ForegroundColor Cyan
    if (-not $allDevs.Count) {
        Write-Host "  none. every project runs the base standard unmodified." -ForegroundColor Gray
    } else {
        foreach ($e in $allDevs) {
            $d = $e.D
            $flag = if ($d.Expired) { 'REVIEW OVERDUE' } elseif ($d.Unowned) { 'UNOWNED' } else { 'ok' }
            $col  = if ($d.Expired -or $d.Unowned) { 'Yellow' } else { 'Gray' }
            Write-Host ("  {0,-14} {1,-4} {2,-38} {3}" -f $e.Project, $d.Id, $d.Rule, $flag) -ForegroundColor $col
        }
        $bad = @($allDevs | Where-Object { $_.D.Expired -or $_.D.Unowned }).Count
        if ($bad) { Write-Host "  $bad deviation(s) need attention: an unowned or overdue waiver is a defect." -ForegroundColor Yellow }
    }

    Write-Host ""
    if ($Fix) {
        Write-Host "TO FIX ALL OF THE ABOVE" -ForegroundColor Cyan
        Write-Host "  .\studio.ps1 -Sync -Force        reset installs and shared governance from base (archives first)"
        Write-Host "  .\studio.ps1 -Compose -All       rebuild every tuned project"
        Write-Host "  .\studio.ps1 -Tune -Project X    start tuning a project"
    } else {
        Write-Host "  -Doctor to see what needs doing.  -Sync to push base everywhere." -ForegroundColor DarkGray
    }
    Write-Host ""
}

# --------------------------------------------------------------- dispatch

if ($Recall) {
    # Runs on PreCompact. Must never fail the session: a hook that throws while context is being
    # dropped costs the session the very thing it was trying to preserve.
    try { Invoke-Recall } catch { }
    return
}

if ($Autoload) {
    # Runs on every session start. Must be fast and silent when there is nothing to do.
    #
    # It must NOT be silent about something it could not do. This is the one path that runs
    # unattended, so a swallowed throw means the roster is not rebuilt, nothing is printed, and
    # the first symptom is a role behaving as though a rule does not exist. Measured on one tree
    # with a fragment missing: -Compose exited 1 and named the fragment, -Autoload exited 0 and
    # printed nothing at all. WARM_START already records that this hook has never been observed
    # firing, which is the same blindness from the other side. Silent success and silent failure
    # were indistinguishable, and now only one of them is silent.
    #
    # It still returns 0. A SessionStart hook that fails the session over a stale roster trades a
    # missing rule for no session, which is the worse of the two.
    $lines = @()
    Write-HookLog 'autoload' $Path
    try {
        $rebuilt = Invoke-Autoload $Path
        if ($rebuilt) { $lines += $rebuilt }

        # THE SESSION BRIEF. -Doctor reports on every project and only ever runs in the studio, so
        # the session that could act on a finding is the one that never sees it. This runs where
        # the work happens. It names the rule and the fix, never "possible drift", and it says
        # nothing at all when nothing is wrong, which is what makes silence worth anything.
        #
        # Wrapped separately from the rebuild on purpose: a brief that throws must not take the
        # rebuild down with it, and neither may fail the session.
        # Computed into a variable first. `if` is a STATEMENT in PowerShell 5.1 and is not valid
        # in an argument position: the file parsed cleanly and threw "the term 'if' is not
        # recognized" at runtime, on every session start, and the bare catch below hid it. Parsing
        # and running are separate questions and only the first was being asked.
        $from = $Path
        if (-not $from) { $from = (Get-Location).Path }
        try {
            $proj = Resolve-OwningProject $from
            if ($proj) {
                foreach ($f in (Get-ProjectBrief $proj)) {
                    $lines += ("STUDIO: " + $f.Rule + ". " + $f.What + " " + $f.Fix)
                }
                # The founder brief, verbatim, so nobody has to open the file and find it. It goes
                # LAST, after any findings: a finding is about this project right now and is worth
                # reading first, while the brief is standing orientation.
                $fb = Get-FounderBrief $proj
                if ($fb) {
                    # WRAPPED AT TWO LINES BY HAND. Written as one sentence this was 134 characters,
                    # which breaks the same 100-column rule the check enforces on the brief below it.
                    # The width rule applied to the founder's words and not to mine, which is the
                    # check having a blind spot exactly where its author was standing.
                    $lines += ("FOUNDER BRIEF, from WARM_START.md, written at the last wind-down." + "`n" +
                               "Treat every number in it as a claim to verify rather than a fact:" + "`n`n" + $fb)
                }
            }
        } catch {
            # NOT a bare catch. This swallowed a live defect for the whole of its first test run,
            # which is the failure a reviewer flagged in the test harness the same day. The brief
            # must never fail the session, and it must never fail SILENTLY either.
            $lines += ("Studio could not read the session brief: " + $_.Exception.Message)
        }
    }
    catch {
        # The SAME shape the success path returns, because the consumer parses this as JSON and a
        # Write-Host line is a different channel it does not read. suppressOutput is deliberately
        # false: a rebuild that quietly did not happen is exactly what must not be suppressed.
        $lines += ("Studio could not rebuild the roster: " + $_.Exception.Message +
                   " Agents in this session may be missing a rule. Run studio.ps1 -Doctor.")
    }
    # ONE write, or nothing. Two ConvertTo-Json documents on the same stream is not valid JSON and
    # the consumer reads whichever it can, which is a worse failure than saying nothing.
    if ($lines.Count) {
        # suppressOutput stays TRUE, which is the long-standing behaviour and is deliberate: it
        # hides the raw JSON echo, and systemMessage reaches the reader either way. An earlier
        # version of this set it to false on the failure path, reasoning that a rebuild which did
        # not happen must not be suppressed. That conflated suppressing the raw stdout with
        # suppressing the MESSAGE, which are different things, and it broke an existing assertion
        # that had been guarding the correct behaviour since before any of this was written.
        # WRAPPED AT 100 COLUMNS. The findings are 175 and 193 characters as written, so they broke
        # the same width rule check-session-brief.js enforces on the brief, and a line count cannot
        # see that: measured at the ST-069 gate, 13 physical lines rendered as 19 at 100 columns and
        # 21 at 80. Wrapping is display only and loses nothing. It does NOT make three findings plus
        # a ten-line brief fit inside 15 lines. Put to the CEO rather than settled by quietly
        # widening their number, and they ruled TWO caps on 2026-08-31: 25 for the whole message,
        # 12 for the brief alone, so the spare room belongs to findings and not to the brief.
        $wrapped = @()
        foreach ($ln in (($lines -join "`n") -split "`r?`n")) {
            if ($ln.Length -le 100) { $wrapped += $ln; continue }
            $cur = ''
            foreach ($w in ($ln -split ' ')) {
                if ($cur -and ($cur.Length + 1 + $w.Length) -gt 100) { $wrapped += $cur; $cur = $w }
                elseif ($cur) { $cur = $cur + ' ' + $w }
                else { $cur = $w }
            }
            if ($cur) { $wrapped += $cur }
        }
        $lines = $wrapped

        # JOINED WITH A NEWLINE, not a space, and the difference is the whole line cap. Joined
        # with " ", three findings plus a rebuild sentence arrive as ONE line of about 650
        # characters, which renders as 19 lines at 100 columns and 21 at 80. So the budget the CEO
        # ruled was being counted in units the tool did not emit: the check subtracted four LINES
        # that never existed as lines, and could not see the one thing that actually blew the
        # budget. qa-tester measured this at the ST-069 gate. Making them real lines is the fix
        # that lets a line cap mean anything at all.
        @{ systemMessage = ($lines -join "`n"); suppressOutput = $true } | ConvertTo-Json -Compress
    }
    return
}

if ($Release) {
    $ok = Invoke-Release
    if (-not $ok) { exit 1 }
    Write-Host ""
    return
}

if ($Publish) {
    $ok = Publish-Public $PublicRepo -DryRun:$DryRun
    if (-not $ok) { exit 1 }
    Write-Host ""
    return
}

if ($Update) {
    # Before the pull, not after. A fast-forward rewrites the working tree, so a guarded run
    # that pulls first has already done the thing the guard exists to prevent, and the refusal
    # afterwards reads as if nothing happened.
    if ($env:STUDIO_SAFE) {
        throw "-Update refused: STUDIO_SAFE is set. It pulls and then rewrites the machine-wide install. Unset it to update for real."
    }
    Write-Host ""; Write-Host "UPDATE" -ForegroundColor Cyan
    git -C $StudioRoot pull --ff-only 2>&1 | ForEach-Object { "  $_" }
    # The pull just moved the base under us, so this is the run most likely to find a role that
    # cannot compose, and the one where a half-applied install is hardest to notice.
    Assert-BaseComposable
    Install-GlobalAgents
    Install-GlobalSkills
    foreach ($p in Find-Projects) { Build-Project $p -Quiet }
    Write-Host ""; Write-Host "Ask the session to name its roles. They normally re-register live; restart only if they do not appear." -ForegroundColor Green; Write-Host ""
    return
}

if ($Connect) {
    Write-Host ""; Write-Host "CONNECT" -ForegroundColor Cyan
    $targets = if ($Project) { @(Resolve-Project $Project) } else { (@(Find-Projects) + @(Get-SessionFolders)) | Sort-Object -Unique }
    foreach ($p in $targets) {
        $res = Connect-Project $p
        $col = switch ($res) { 'current' {'DarkGray'} 'updated' {'Green'} default {'Green'} }
        Write-Host ("  {0,-9} {1}" -f $res, $p.Replace("$ProjectsRoot\", '')) -ForegroundColor $col
    }
    Write-Host ""
    return
}

if ($Tune) {
    if (-not $Project) { throw "-Tune needs -Project <name>" }
    Write-Host ""; Write-Host "TUNE" -ForegroundColor Cyan
    Initialize-Tuning $Project
    Write-Host ""
    return
}

if ($Compose) {
    Write-Host ""; Write-Host "COMPOSE" -ForegroundColor Cyan
    if ($All)         { foreach ($p in Find-Projects) { Build-Project $p -Quiet } }
    elseif ($Project) {
        $target = Resolve-Project $Project
        # Loud here, quiet inside Build-Project. Somebody who typed this asked a direct
        # question and deserves a direct refusal rather than a silent no-op.
        if (Test-IsInStudio $target) {
            throw "-Compose is refused for the studio itself. It is the SOURCE of the roster, not a consumer of it, and it has no overlays to compose. Edit base\agents and run -Sync to push the change everywhere."
        }
        Build-Project $target
    }
    else              { throw "-Compose needs -Project <name> or -All" }
    Write-Host ""; Write-Host "Ask the session to name its roles. They normally re-register live; restart only if they do not appear." -ForegroundColor Green; Write-Host ""
    return
}

if ($Governance) {
    Write-Host ""; Write-Host "GOVERNANCE" -ForegroundColor Cyan
    foreach ($p in Find-Projects) {
        $gr = Get-GovRoot $p
        if ($gr) { Write-Host "  $($gr.Replace("$ProjectsRoot\",''))"; Sync-Governance $gr (Split-Path $gr -Leaf) }
    }
    Write-Host ""
    return
}

if ($Sync -or $Global) {
    Write-Host ""; Write-Host "SYNC" -ForegroundColor Cyan
    # Before the first writer, not after the last one.
    Assert-BaseComposable
    Install-GlobalAgents
    Install-GlobalSkills
    if ($Sync) {
        $seen = @()
        foreach ($p in Find-Projects) {
            $gr = Get-GovRoot $p
            if ($gr -and $seen -notcontains $gr) { $seen += $gr; Write-Host "  $($gr.Replace("$ProjectsRoot\",''))"; Sync-Governance $gr (Split-Path $gr -Leaf) }
        }
        # Sync-Governance carries the missing-governance report, so every path that places any
        # governance at all says it. This covers the path that places NONE: Get-GovRoot only
        # returns a root for a project that ALREADY holds one of the shared files, so on a fresh
        # public install the loop above never runs, the function is never called, and the report
        # would never be reached. That is precisely the install the warning exists for.
        if (-not $seen.Count) {
            $govMissing = @($SHARED_GOV | Where-Object { -not (Test-Path (Join-Path $GOV_BASE $_)) })
            Write-Host ""
            Write-Host "GOVERNANCE  not distributed" -ForegroundColor Yellow
            if ($govMissing.Count -eq $SHARED_GOV.Count) {
                Write-Host "  This install carries no shared governance, so none was placed anywhere." -ForegroundColor Yellow
                Write-Host "  The roles reference a release protocol, a board protocol and deploy gates" -ForegroundColor Yellow
                Write-Host "  as things that exist. Write your own at base\governance\, or delete the" -ForegroundColor Yellow
                Write-Host "  import lines from each CLAUDE.md so nothing points at a document nobody has." -ForegroundColor Yellow
            } else {
                Write-Host "  no project holds any shared governance yet, so there was nothing to update." -ForegroundColor Yellow
                Write-Host "  Place the files once by hand; after that -Sync keeps them current." -ForegroundColor Yellow
            }
        }
        Write-Host ""; Write-Host "COMPOSE" -ForegroundColor Cyan
        foreach ($p in Find-Projects) { Build-Project $p -Quiet }
    }
    Write-Host ""; Write-Host "Ask the session to name its roles. They normally re-register live; restart only if they do not appear." -ForegroundColor Green; Write-Host ""
    return
}

Show-Status -Fix:$Doctor