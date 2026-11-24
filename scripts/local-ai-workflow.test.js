import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const script = resolve('scripts/local-ai-workflow.ps1')
const quote = (s) => `'${s.replaceAll("'", "''")}'`

function runScenarios() {
  const dir = mkdtempSync(join(tmpdir(), 'katedra-workflow-'))
  const log = join(dir, 'calls.jsonl')
  const harness = join(dir, 'harness.ps1')
  writeFileSync(harness, `
function Record($name, $values) {
  @{scenario=$global:katedraTestScenario; name=$name; values=@($values); cwd=(Get-Location).Path} | ConvertTo-Json -Compress | Add-Content -LiteralPath ${quote(log)}
  $global:LASTEXITCODE = 0
  if ($name -eq $global:katedraTestScenario -or ($name -eq 'npm' -and $values[1] -eq $global:katedraTestScenario)) { $global:LASTEXITCODE = 7 }
}
function git { Record 'git' $args; if ($args[0] -eq 'rev-parse') { 'true' } }
function claude { Record 'claude' $args }
function grok { Record 'grok' $args }
function npm { Record 'npm' $args }
foreach ($global:katedraTestScenario in @('success', 'claude', 'grok', 'typecheck', 'lint', 'test:ci', 'build', 'dry')) {
  & ${quote(script)} -Task 'Fix quotes " and $(throw "injected") & syntax' -DryRun:($global:katedraTestScenario -eq 'dry')
  @{scenario=$global:katedraTestScenario; name='result'; code=$LASTEXITCODE} | ConvertTo-Json -Compress | Add-Content -LiteralPath ${quote(log)}
}
exit 0
`, 'utf8')
  try {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness], { cwd: dir, encoding: 'utf8', timeout: 120000 })
    let calls = []
    try { calls = readFileSync(log, 'utf8').trim().split(/\r?\n/).map(JSON.parse) } catch { /* No commands were invoked. */ }
    return { ...result, calls }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

describe.skipIf(process.platform !== 'win32')('local Claude and Grok workflow', () => {
  let execution
  beforeAll(() => {
    execution = runScenarios()
    expect(execution.error).toBeUndefined()
    expect(execution.status, execution.stderr).toBe(0)
  }, 130000)
  function run(scenario = 'success') {
    const entries = execution.calls.filter(c => c.scenario === scenario)
    return { stdout: execution.stdout, stderr: execution.stderr, status: entries.find(c => c.name === 'result')?.code, calls: entries.filter(c => c.name !== 'result') }
  }
  it('runs both CLIs then all four checks in the project, passing task text literally', () => {
    const result = run()
    expect(result.status, result.stderr).toBe(0)
    const stages = result.calls.filter(c => c.name !== 'git')
    expect(stages.map(c => c.name)).toEqual(['claude', 'grok', 'npm', 'npm', 'npm', 'npm'])
    expect(stages[0].values.join(' ')).toContain('$(throw "injected")')
    expect(stages[1].values).toContain('plan')
    expect(stages.slice(2).map(c => c.values)).toEqual(['typecheck', 'lint', 'test:ci', 'build'].map(s => ['run', s]))
    expect(stages.every(c => c.cwd.toLowerCase() === resolve('.').toLowerCase())).toBe(true)
    expect(result.calls.filter(c => c.name === 'git').every(c => ['rev-parse', 'status'].includes(c.values[0]))).toBe(true)
  }, 70000)
  it.each(['claude', 'grok', 'typecheck', 'lint', 'test:ci', 'build'])('stops on failure of %s', (stage) => {
    const result = run(stage)
    expect(result.status).toBe(1)
    const last = result.calls.at(-1)
    expect(last.name === 'npm' ? last.values[1] : last.name).toBe(stage)
  }, 70000)
  it('dry run launches neither providers nor checks', () => {
    const result = run('dry')
    expect(result.status, result.stderr).toBe(0)
    expect(result.calls.filter(c => c.name !== 'git')).toEqual([])
    expect(result.stdout).toContain('Claude')
    expect(result.stdout).toContain('Grok')
  }, 70000)
})
