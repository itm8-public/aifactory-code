# Bug: __FEATURE__

- Bug: `__ID__`
- Reported: __DATE__
- Verdict: open

<!-- Verdict: open, verified (the failing test passes, the suite passes, no new build-check FAIL),
partial (say what is left) or failed (say what was learned). No real customer data in this file:
describe the data or use synthetic data. -->

## Symptom

<What the person saw, where, and what they expected instead.>

## Reproduction

1. <step>
2. <step>

## Failing test

<!-- Written and run before any fix. If no automated test can reproduce it, say why and how you reproduced it instead. -->

- Test: `<test file>`, "<test name>"
- Before the fix: <the failing assertion or error, one line>

## Root cause

<Why it happened, in one paragraph.>

## Fix

<Files changed, and why this is the smallest fix.>

## Verification

- The failing test passes: <yes or no>
- The whole test suite passes: <yes or no>
- Build check: <no new FAIL, or what changed>
