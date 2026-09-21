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
## Hardening

### OWNER APPROVED
An asset enters APPROVED only after explicit owner approval (for example `APRUEBO VISUAL <name> vN` or an equivalent explicit approval). Positive but ambiguous phrases such as `se ve bien`, `continúa`, or `dale` do not freeze an asset.

### Cryptographic lock
Every APPROVED asset must be registered in a canonical `assets.lock.json` with logical id, version, path, state, SHA256, approval date and approval reference. CI/TEST must fail when the file is missing or its SHA256 differs.

### Browser delivery
For APPROVED assets, avoid transformations that change bytes without owner authorization. If Next.js `Image` is used and binary identity matters, use `unoptimized`; otherwise use a direct `<img>` when clearer.

### Legitimate revisions
Never overwrite an APPROVED asset. A new revision uses a new file and SHA256, requires new explicit approval, and the previous revision becomes `SUPERSEDED` while remaining available for traceability/rollback.

### Frozen design tokens
When a card/hero becomes the module pattern, freeze its relevant tokens: spacing, radii, shadows/glow, typography hierarchy, scale/proportions, background/border rules and responsive behavior.

### Required GUI viewport
Visual-library GUI QA must include at least 1366x768; add 1920x1080 and mobile/tablet when the module requires them.

### Anti-reconstruction guardrail
CI should use scoped checks where practical to detect prohibited parallel reconstructions (inline SVG, Three.js/canvas, CSS-art, or alternate assets) in components that consume an APPROVED asset.

