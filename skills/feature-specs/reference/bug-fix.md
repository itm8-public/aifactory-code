# Fixing a bug: failing test first

1. **Report**: `feature.mjs bug --title "<what goes wrong>"` creates
   `specs/bugs/BNNN-slug/report.md`. Fill in the symptom and reproduction from the person's words.
   No real customer data: describe it or make synthetic data that shows the same thing.
2. **Reproduce with a failing test** before touching the code. Use the project's test runner
   (Vitest for TypeScript, pytest for Python). Run it, see it fail for the reason in the report,
   and paste the failing line into "Failing test". If no automated test can reproduce it (layout,
   a Microsoft 365 client), say why and how you reproduced it instead.
3. **Root cause**: why it happened, not only where.
4. **Fix**: the smallest change that makes the test pass. No refactoring on the side.
5. **Verify**: the new test passes, the whole suite passes, the build check shows no new FAIL.
6. **Verdict** in the header:
   - `verified`: all three checks above hold.
   - `partial`: some of it is fixed; say what is left.
   - `failed`: not fixed; say what was learned and what to try next.

Do not mark `verified` without having run the tests in this session. When the bug sits at a trust
boundary (`GUARD.md` step 3), the failing test is a refusal test: it tries to cross the boundary
and must be refused after the fix. A bug that touches data,
sign-in or permissions is also a stop-and-ask check: if the bug exposed data to the wrong
people, tell the person at once; it may be an incident, not only a bug.
