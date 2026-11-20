#!/usr/bin/env node
// PreToolUse guard for the shell tools (Bash and PowerShell). The rules are in
// lib/command-guard.mjs. Two tiers:
//  deny  never run: a recursive delete of /, ~, a drive root or a `..` path outside the project;
//        a force push to main or master; a download piped into a shell; a flag that switches off
//        permission checks; a commit or push with --no-verify.
//  ask   a person confirms in the permission prompt: other force pushes, git reset --hard,
//        git clean -f, git branch -D, tag deletes, DROP and TRUNCATE sent to a database, az and
//        Remove-Az deletes, azd down, terraform destroy, kubectl delete, Remove-Item -Recurse
//        -Force outside the project, npm publish, gh repo delete, docker system prune.
// Guidance, not a security boundary: a command can be written so that no rule sees it. Malformed
// input fails open. AIFACTORY_COMMAND_GUARD=off turns it off for a session.
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { findRisk } from '../../lib/command-guard.mjs';
import { decision, runGuard } from '../../lib/hook.mjs';

const SHELL_TOOLS = { Bash: 'bash', PowerShell: 'powershell' };

/** The current git branch, for a force push that names none. Null when git cannot tell. */
function currentBranch(cwd) {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 2000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const MESSAGE = {
  deny: (r) =>
    `Blocked: ${r.what}. ${r.why} If it is really needed, a person can run it themselves in their own terminal. Do not try it another way.`,
  ask: (r) =>
    `Needs a person to confirm: ${r.what}. ${r.why} It does not run without that confirmation; a person can also run it themselves in their own terminal.`,
};

/** Returns the decision JSON, or null to stay silent. */
function decide(input) {
  const shell = SHELL_TOOLS[input?.tool_name];
  const command = input?.tool_input?.command;
  if (!shell || typeof command !== 'string') return null;
  const cwd = typeof input.cwd === 'string' ? input.cwd : undefined;
  const risk = findRisk(command, {
    shell,
    cwd,
    project: process.env.CLAUDE_PROJECT_DIR || cwd,
    home: homedir(),
    branch: () => currentBranch(cwd),
  });
  return risk ? decision(risk.tier, 'command guard', MESSAGE[risk.tier](risk)) : null;
}

runGuard('AIFACTORY_COMMAND_GUARD', decide);
