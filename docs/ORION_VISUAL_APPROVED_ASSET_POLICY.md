# ORION Visual Approved Asset Policy

## Core rule
**APPROVED ASSET = IMMUTABLE BINARY.**

When the owner explicitly approves a visual asset:
- do not regenerate it;
- do not reinterpret or redraw it;
- do not replace it with a similar render;
- integrate the approved binary directly;
- preserve aspect ratio and composition;
- record path/version and SHA256 when applicable;
- validate the real GUI before closure.

## Required flow
REFERENCE → CANDIDATE → VISUAL/PIXEL COMPARISON → OWNER APPROVED → BINARY FREEZE → INTEGRATION → GUI TEST → VALIDATION → CLOSE.

Before OWNER APPROVED, iterate as needed and do not promote the candidate to final.
After OWNER APPROVED, creative iteration stops unless the owner explicitly reopens it.

## Module workflow
When a visual pattern is already approved:
**BATCH DESIGN + INDIVIDUAL QA + GLOBAL CLOSE.**

- Build the complete module/cards in batch from the approved visual system.
- Validate each card/screen individually.
- Fix only failing pieces; do not destroy approved pieces.

For a new module without an approved pattern:
1. finish one representative card/hero;
2. get owner approval;
3. freeze it as the pattern;
4. expand to the rest of the module in batch;
5. validate each piece and then the module E2E.

## Closure evidence
- final asset reference;
- SHA256 when applicable;
- real TEST screenshot;
- no-crop/no-distortion verification;
- typecheck/smoke as applicable;
- modified files list;
- final state: IMPLEMENTED or NEEDS_FIX.

Only the owner may authorize an exception to this policy.
