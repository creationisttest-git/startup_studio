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
    [switch]$Connect,
    [switch]$Autoload,
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

if (-not $ProjectsRoot) { $ProjectsRoot = if ($CONFIG.ProjectsRoot) { $CONFIG.ProjectsRoot } else { Split-Path $StudioRoot -Parent } }
if (-not $PublicRepo)   { $PublicRepo   = $CONFIG.PublicRepo }

$AGENT_BASE  = Join-Path $StudioRoot 'base\agents'
$GOV_BASE    = Join-Path $StudioRoot 'base\governance'
$ARCHIVE     = Join-Path $StudioRoot '.archive'
$OVERLAY_DIR = '.claude\agent-overlays'
$AGENT_DIR   = '.claude\agents'
$CARD_NAME   = '_project.md'

# Governance files that are IDENTICAL in every project. A project's own
# WAYS_OF_WORKING / WARM_START / SOURCE_OF_TRUTH are its own and never distributed.
$SHARED_GOV = @('GLOBAL_WAYS_OF_WORKING.md','AGENTS.md','BRIDGE_PROTOCOL.md')

function Get-Sha ([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    (Get-FileHash -Path $Path -Algorithm SHA256).Hash
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

function Split-Doc ([string]$Path) {
    $raw   = Get-Content $Path -Raw
    $lines = $raw -split "`r?`n"
    if ($lines[0].Trim() -ne '---') { return @{ Front = [ordered]@{}; Body = $raw } }
    $front = [ordered]@{}; $i = 1
    while ($i -lt $lines.Count -and $lines[$i].Trim() -ne '---') {
        $idx = $lines[$i].IndexOf(':')
        if ($idx -gt 0) { $front[$lines[$i].Substring(0,$idx).Trim()] = $lines[$i].Substring($idx+1).Trim() }
        $i++
    }
    @{ Front = $front; Body = ($lines[($i+1)..($lines.Count-1)] -join "`r`n").Trim() }
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
    $base = Split-Doc $BaseFile.FullName
    $role = $BaseFile.BaseName
    # NB: never name a local $card here. PowerShell names are case-insensitive and
    # dynamic scoping would let it shadow $CARD_NAME, silently dropping the stack card.
    $cardPath    = Join-Path $ProjectPath "$OVERLAY_DIR\$CARD_NAME"
    $overlayPath = Join-Path $ProjectPath "$OVERLAY_DIR\$role.md"

    $front = [ordered]@{}
    foreach ($k in $base.Front.Keys) { $front[$k] = $base.Front[$k] }

    $sections = @()
    if (Test-Path $cardPath) {
        $c = Split-Doc $cardPath
        if ($c.Body) { $sections += $c.Body }
    }
    if (Test-Path $overlayPath) {
        $ov = Split-Doc $overlayPath
        foreach ($k in $ov.Front.Keys) { $front[$k] = $ov.Front[$k] }
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

    $parts = @((Format-Front $front), '', $header) + $preface + @('', $base.Body)
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

# --------------------------------------------------------------- discovery

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
    $found | Sort-Object -Unique
}

function Resolve-Project ([string]$Name) {
    $p = if (Test-Path $Name) { (Resolve-Path $Name).Path } else { Join-Path $ProjectsRoot $Name }
    if (-not (Test-Path $p)) { throw "Project not found: $p" }
    $p
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

function Install-GlobalAgents {
    $files  = Get-BaseAgents
    $target = Join-Path $env:USERPROFILE '.claude\agents'
    if (-not (Test-Path $target) -and -not $WhatIf) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
    $upd=@(); $same=@(); $skip=@()
    foreach ($f in $files) {
        $d = Join-Path $target $f.Name; $dh = Get-Sha $d
        if ($null -eq $dh)                     { if(-not $WhatIf){Copy-Item $f.FullName $d -Force}; $upd+=$f.BaseName }
        elseif ($dh -eq (Get-Sha $f.FullName)) { $same+=$f.BaseName }
        elseif ($Force)                        { if(-not $WhatIf){Copy-Item $f.FullName $d -Force}; $upd+=$f.BaseName }
        else                                   { $skip+=$f.BaseName }
    }
    Write-Host "  agents  updated $($upd.Count), current $($same.Count)" -ForegroundColor Gray
    if ($skip.Count) { Write-Host "  HAND-EDITED here, not promoted to base: $($skip -join ', ')" -ForegroundColor Yellow }
}

function Sync-Governance ([string]$GovRoot, [string]$Label) {
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
"@ | Set-Content $cardPath -Encoding utf8
    Write-Host "  created stack card: $cardPath" -ForegroundColor Green
    Write-Host "  Fill it in, then: studio.ps1 -Compose -Project `"$Name`"" -ForegroundColor DarkGray
}

function Build-Project ([string]$ProjectPath, [switch]$Quiet, [switch]$Silent) {
    $proj       = Split-Path $ProjectPath -Leaf
    $overlayDir = Join-Path $ProjectPath $OVERLAY_DIR
    $agentDir   = Join-Path $ProjectPath $AGENT_DIR
    if (-not (Test-Path $overlayDir)) { if (-not $Quiet) { Write-Host "  $proj has no overlays, runs on the base install" -ForegroundColor DarkGray }; return }

    $hasCard  = Test-Path (Join-Path $overlayDir $CARD_NAME)
    $roleOv   = @(Get-ChildItem $overlayDir -Filter *.md -File | Where-Object { $_.Name -ne $CARD_NAME } | ForEach-Object { $_.BaseName })
    $files    = if ($hasCard) { Get-BaseAgents } else { Get-BaseAgents | Where-Object { $roleOv -contains $_.BaseName } }
    if (-not $files) { Write-Host "  $proj overlay folder is empty" -ForegroundColor DarkGray; return }
    if (-not (Test-Path $agentDir) -and -not $WhatIf) { New-Item -ItemType Directory -Path $agentDir -Force | Out-Null }

    $manifest = @{}
    foreach ($f in $files) {
        if (-not $WhatIf) { Set-Content (Join-Path $agentDir $f.Name) (New-ComposedAgent $f $ProjectPath $proj) -Encoding utf8 -NoNewline }
        $manifest[$f.BaseName] = @{ base = Get-Sha $f.FullName }
    }
    if (-not $WhatIf) {
        $manifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $agentDir '.sync-manifest.json') -Encoding utf8
        Get-ChildItem $agentDir -Filter *.md -File | Where-Object { $files.Name -notcontains $_.Name } | ForEach-Object { Remove-Item $_.FullName -Force }
    }
    if (-not $Silent) {
        Write-Host ("  {0}: {1} roles composed, card {2}, overlays [{3}]" -f $proj, $files.Count, $(if($hasCard){'yes'}else{'no'}), $(if($roleOv.Count){$roleOv -join ', '}else{'none'})) -ForegroundColor Green
    }
}

# --------------------------------------------------------------- publish

# The patterns live in studio.config.ps1, not here, because the list itself names every
# project and client and must never be published. No config means no publishing: the scan
# fails closed rather than waving everything through.
$LEAK_PATTERNS = if ($CONFIG.LeakPatterns) { $CONFIG.LeakPatterns } else { $null }

function Invoke-LeakScan ([string]$Dir) {
    if (-not $LEAK_PATTERNS) { throw "No leak patterns configured. Refusing to publish without a scan. Add LeakPatterns to studio.config.ps1." }
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
    @{ from = 'new-project';  to = 'new-project' },
    @{ from = 'studio.ps1';   to = 'studio.ps1' },
    @{ from = 'index.html';   to = 'index.html' },
    @{ from = 'METHOD.md';    to = 'METHOD.md' },
    @{ from = 'CHANGELOG.md'; to = 'CHANGELOG.md' },
    @{ from = 'LICENSE';      to = 'LICENSE' },
    @{ from = 'LICENCE-NOTES.md'; to = 'LICENCE-NOTES.md' },
    @{ from = 'base\board';   to = 'board' },
    @{ from = 'CNAME';        to = 'CNAME' },
    @{ from = 'robots.txt';   to = 'robots.txt' },
    @{ from = 'sitemap.xml';  to = 'sitemap.xml' },
    @{ from = 'og.png';       to = 'og.png' }
)

function Publish-Public ([string]$RepoUrl, [switch]$DryRun) {
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

        # CHANGELOG.md is the source of the release note, because internal commit subjects
        # are written for us and mean nothing to someone who just found the repo. Take the
        # newest dated section verbatim.
        $subject = "Update: $($changed.Count) file(s) changed"
        $body    = "Files updated: " + (($changed | Select-Object -First 10) -join ', ')
        $clPath  = Join-Path $StudioRoot 'CHANGELOG.md'
        if (Test-Path $clPath) {
            $cl = Get-Content $clPath -Raw
            $sec = [regex]::Match($cl, '(?ms)^## (\d{4}-\d{2}-\d{2})\s*\r?\n(.*?)(?=^## |\z)')
            if ($sec.Success) {
                $date  = $sec.Groups[1].Value
                $notes = $sec.Groups[2].Value.Trim()
                $heads = @([regex]::Matches($notes, '(?m)^### (.+)$') | ForEach-Object { $_.Groups[1].Value })
                $subject = if ($heads.Count -eq 1) { $heads[0] } elseif ($heads.Count) { "$($heads[0]), and $($heads.Count - 1) other change(s)" } else { "Release $date" }
                $body = ($notes -replace '(?m)^### .+\r?\n\r?\n?','').Trim()
            }
        }

        $msg = @"
$subject

$body

---
$($changed.Count) file(s) changed: $(($changed | Select-Object -First 10) -join ', ')
Full history and rationale: CHANGELOG.md

Studio-Source: $studioSha
"@
        $who = $CONFIG.PublishAs
        $idArgs = if ($who) { @('-c', "user.name=$($who.Name)", '-c', "user.email=$($who.Email)") } else { @() }

        # -F a file, never -m. The message carries the changelog section verbatim, including
        # fenced code blocks and blank lines, and passing that as a native-command argument
        # silently mangles it: the commit fails and staged changes just sit there.
        $msgFile = Join-Path ([IO.Path]::GetTempPath()) ("studio-commit-{0}.txt" -f [guid]::NewGuid())
        # UTF8 WITHOUT a BOM; Set-Content -Encoding utf8 on PS 5.1 emits one and git keeps it
        [System.IO.File]::WriteAllText($msgFile, $msg, (New-Object System.Text.UTF8Encoding $false))
        git @idArgs commit -q -F $msgFile
        $committed = ($LASTEXITCODE -eq 0)
        Remove-Item $msgFile -Force -ErrorAction SilentlyContinue

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
    } finally { $ErrorActionPreference = $prevEAP }
    $true
}

# --------------------------------------------------------------- autoload

# Fast path for the SessionStart hook. Finds the project containing $Path, rebuilds its
# composed roster only if the base has moved, and stays silent when nothing is needed.
function Invoke-Autoload ([string]$Path) {
    $dir = if ($Path) { $Path } else { (Get-Location).Path }
    $cur = $dir
    while ($cur -and $cur -ne (Split-Path $cur -Parent)) {
        if (Test-Path (Join-Path $cur $OVERLAY_DIR)) { break }
        $parent = Split-Path $cur -Parent
        if ($parent -eq $ProjectsRoot -or $parent -eq $cur) { $cur = $null; break }
        $cur = $parent
    }
    if (-not $cur -or -not (Test-Path (Join-Path $cur $OVERLAY_DIR))) { return }

    $agDir = Join-Path $cur $AGENT_DIR
    $manPath = Join-Path $agDir '.sync-manifest.json'
    $needs = $true
    if (Test-Path $manPath) {
        $needs = $false
        $man = Get-Content $manPath -Raw | ConvertFrom-Json
        foreach ($f in (Get-ChildItem $AGENT_BASE -Filter *.md -File)) {
            $rec = $man.PSObject.Properties[$f.BaseName]
            if (-not $rec -or $rec.Value.base -ne (Get-Sha $f.FullName)) { $needs = $true; break }
        }
        if (-not $needs) {
            foreach ($ov in (Get-ChildItem (Join-Path $cur $OVERLAY_DIR) -Filter *.md -File)) {
                if ($ov.LastWriteTime -gt (Get-Item $manPath).LastWriteTime) { $needs = $true; break }
            }
        }
    }
    if (-not $needs) { return }
    Build-Project $cur -Quiet -Silent
    # Report through the hook contract rather than printing, so a no-op stays invisible
    # and a real rebuild surfaces as one line the user actually sees.
    @{ systemMessage = "Studio agents rebuilt for $(Split-Path $cur -Leaf) from base $(Get-StudioVersion)." ; suppressOutput = $true } | ConvertTo-Json -Compress
}

# --------------------------------------------------------------- connect

# Writes a delimited pointer block into a project's CLAUDE.md so any session opened there
# knows the roster is generated and where the real source is. Idempotent: the markers let
# it be rewritten in place rather than accumulating copies.
function Connect-Project ([string]$ProjectPath) {
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
        $c = Get-Content $file -Raw
        if ($c -match [regex]::Escape($begin)) {
            $pattern = [regex]::Escape($begin) + '[\s\S]*?' + [regex]::Escape($end)
            $new = [regex]::Replace($c, $pattern, $block.Replace('$','$$'))
            if ($new -eq $c) { return 'current' }
            if (-not $WhatIf) { Set-Content $file $new -Encoding utf8 -NoNewline }
            return 'updated'
        }
        if (-not $WhatIf) { Set-Content $file ($c.TrimEnd() + "`r`n`r`n" + $block + "`r`n") -Encoding utf8 -NoNewline }
        return 'appended'
    }
    if (-not $WhatIf) { Set-Content $file ("# $name`r`n`r`n" + $block + "`r`n") -Encoding utf8 -NoNewline }
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

# --------------------------------------------------------------- reporting

function Show-Status ([switch]$Fix) {
    $agents = Get-BaseAgents
    Write-Host ""
    Write-Host "STUDIO" -ForegroundColor Cyan
    Write-Host "  base roster     $($agents.Count) roles   $AGENT_BASE"
    Write-Host "  base governance $($SHARED_GOV.Count) files   $GOV_BASE"

    $g = Join-Path $env:USERPROFILE '.claude\agents'
    $missing=@(); $drift=@()
    foreach ($f in $agents) {
        $d = Join-Path $g $f.Name
        if (-not (Test-Path $d)) { $missing += $f.BaseName } elseif ((Get-Sha $f.FullName) -ne (Get-Sha $d)) { $drift += $f.BaseName }
    }
    Write-Host ""
    Write-Host "BASE INSTALL (used by untuned projects)" -ForegroundColor Cyan
    Write-Host ("  $g")
    Write-Host ("  missing {0}, drifted {1}" -f $missing.Count, $drift.Count) -ForegroundColor $(if($missing.Count -or $drift.Count){'Yellow'}else{'Gray'})
    if ($drift.Count) { Write-Host "  drift means someone edited the install instead of the base: $($drift -join ', ')" -ForegroundColor Yellow }

    Write-Host ""
    Write-Host "PROJECTS" -ForegroundColor Cyan
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
                $stale = @()
                foreach ($f in $agents) { $rec = $man.PSObject.Properties[$f.BaseName]; if ($rec -and $rec.Value.base -ne (Get-Sha $f.FullName)) { $stale += $f.BaseName } }
                if ($stale.Count) { Write-Host "      STALE vs base ($($stale.Count) roles), run -Compose" -ForegroundColor Yellow }
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

if ($Autoload) {
    # Runs on every session start. Must be fast and silent when there is nothing to do.
    try { Invoke-Autoload $Path } catch { }
    return
}

if ($Publish) {
    $ok = Publish-Public $PublicRepo -DryRun:$DryRun
    if (-not $ok) { exit 1 }
    Write-Host ""
    return
}

if ($Update) {
    Write-Host ""; Write-Host "UPDATE" -ForegroundColor Cyan
    git -C $StudioRoot pull --ff-only 2>&1 | ForEach-Object { "  $_" }
    Install-GlobalAgents
    foreach ($p in Find-Projects) { Build-Project $p -Quiet }
    Write-Host ""; Write-Host "Restart the Claude Code session to pick up agent changes." -ForegroundColor Green; Write-Host ""
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
    elseif ($Project) { Build-Project (Resolve-Project $Project) }
    else              { throw "-Compose needs -Project <name> or -All" }
    Write-Host ""; Write-Host "Restart the Claude Code session to pick up agent changes." -ForegroundColor Green; Write-Host ""
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
    Install-GlobalAgents
    if ($Sync) {
        $seen = @()
        foreach ($p in Find-Projects) {
            $gr = Get-GovRoot $p
            if ($gr -and $seen -notcontains $gr) { $seen += $gr; Write-Host "  $($gr.Replace("$ProjectsRoot\",''))"; Sync-Governance $gr (Split-Path $gr -Leaf) }
        }
        Write-Host ""; Write-Host "COMPOSE" -ForegroundColor Cyan
        foreach ($p in Find-Projects) { Build-Project $p -Quiet }
    }
    Write-Host ""; Write-Host "Restart the Claude Code session to pick up agent changes." -ForegroundColor Green; Write-Host ""
    return
}

Show-Status -Fix:$Doctor
