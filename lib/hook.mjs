// Shared plumbing for the PreToolUse guards: read the hook input from stdin, print one decision.
// The decision format is the documented PreToolUse output (hookSpecificOutput.permissionDecision:
// "deny" stops the call and Claude reads the reason; "ask" shows the reason to the person in the
// permission prompt). Several hooks combine as deny > ask > allow.

export const decision = (permissionDecision, guard, reason) =>
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      permissionDecisionReason: `[aifactory-code ${guard}] ${reason}`,
    },
  });

/**
 * Runs a guard. `decide(input)` returns the decision JSON, or null to stay silent. The off switch
 * (`<NAME>=off`), malformed input and any error fail open: no output, exit code 0.
 */
export async function runGuard(offSwitch, decide) {
  try {
    if ((process.env[offSwitch] ?? '').toLowerCase() === 'off') return;
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    const out = decide(JSON.parse(data));
    if (out) process.stdout.write(out);
  } catch {
    // fail open
  }
}
