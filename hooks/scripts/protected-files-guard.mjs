#!/usr/bin/env node
// PreToolUse guard for Write, Edit and MultiEdit. When Claude changes CI, deployment or
// infrastructure configuration that is already in the repository (workflows, pipeline files,
// infra/, Bicep, Terraform, Dockerfiles, CODEOWNERS and branch protection files; the list is in
// lib/protected-files.mjs), it returns the "ask" decision, so a person confirms the change.
//
// The rule: ask only when the file exists and git tracks it. A new file is not asked about, and
// neither is anything in a folder that is not a git repository or has nothing added yet. That
// keeps a brand-new project (the scaffold, and the edits right after it) free of prompts.
//
// Guidance, not a security boundary. Malformed input, a missing git and any error fail open.
// AIFACTORY_PROTECTED_FILES_GUARD=off turns it off for a session.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { decision, runGuard } from '../../lib/hook.mjs';
import { protectedKind } from '../../lib/protected-files.mjs';

/** The file's path inside its repository when it exists and git tracks it, else null. */
function trackedPath(file) {
  if (!existsSync(file)) return null;
  try {
    const out = execFileSync('git', ['ls-files', '--full-name', '-z', '--error-unmatch', '--', basename(file)], {
      cwd: dirname(file),
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0')[0] || null;
  } catch {
    return null; // not tracked, not a repository, or no git
  }
}

/** Returns the decision JSON, or null to stay silent. */
function decide(input) {
  if (!['Write', 'Edit', 'MultiEdit'].includes(input?.tool_name)) return null;
  const raw = String(input.tool_input?.file_path ?? '');
  if (!raw) return null;
  const file = isAbsolute(raw) ? raw : resolve(input.cwd ?? process.cwd(), raw);
  if (!protectedKind(file)) return null; // a cheap test before asking git
  const tracked = trackedPath(file);
  const what = tracked && protectedKind(tracked);
  if (!what) return null;
  return decision(
    'ask',
    'protected files guard',
    `${tracked} is ${what} that is already in the repository. A change here changes what runs for everyone, so a person confirms it.`,
  );
}

runGuard('AIFACTORY_PROTECTED_FILES_GUARD', decide);
