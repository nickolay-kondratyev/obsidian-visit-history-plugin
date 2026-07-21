# CLARIFICATION — dev config overrides for e2e

Ticket is specific and self-consistent. No human-blocking ambiguities. Assumptions locked below.

## WHAT we build
1. `ConfigProvider` interface (+ `ConfigProviderDefault`) — the ONLY seam other code depends on for
   effective config values. Hides existence of dev overrides entirely.
2. A dev-overrides source: reads env var `__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__` → JSON file,
   ONCE at construction, guarded desktop-only Node access (mirror `DesktopOsInfo`), try/catch, empty on any failure.
3. Effective idle timeout = override value (if present & a positive number — NOT re-clamped to the min-5 floor)
   else the sanitized persisted setting. Route `FocusDurationTracker`'s idle closure through ConfigProvider.
4. Wire an e2e test that sets a sub-floor idle timeout via the overrides file and asserts the idle path fires fast.

## Key decisions (Pareto)
- **Extensible but minimal**: override JSON is a typed partial map; only `idleTimeoutSeconds` is consumed now.
  Structure so adding more keys (e.g. `unfocusGraceMs`) later is trivial — but we do NOT wire extra keys now
  (no unused code). See CALLOUT.
- **Overrides bypass the hard floor** by design — that IS the ticket's purpose ("override even hard-limited").
  Overrides do NOT touch persisted settings / data.json; they are a runtime read-through only.
- **Mobile-safe**: no override path on mobile; provider silently returns settings-based values.
- **No override file / no env var (normal users)** → provider behaves exactly as today. Zero behavior change in prod.

## CALLOUT for human (non-blocking)
- Scope limited to `idleTimeoutSeconds` override for now (delivers the idle e2e test). The abstraction is
  built to extend to non-setting constants (e.g. `UNFOCUS_GRACE_MS`, per `_tickets/e2e-grace-timer-expiry-spec.md`)
  but those are NOT wired in this change to avoid unused code. Follow-up ticket if desired.
