# Plugin onload hard-fails if user-name resolution throws

**RESOLVED (2026-07, user-name confirmation modal):** resolution moved off the
`onload` path entirely — it runs on `onLayoutReady` inside
`main.ts#pinUserNameAndStartRecording`, which try/catches and degrades to
"no VH recording this session" (`console.error`). The plugin always loads.

`main.ts onload`: `VhUserScopeMigrationService.migrateIfLegacyPresent()` is
try/caught, but `UserNameProviderDefault.getUserName()` is not. On the mobile
path a `listSubfolderNames` rejection (adapter error, not merely a missing
folder) fails the entire plugin load.

Introduced with the user-id change (not the V2 removal); flagged during the
rebase review.

**Decision needed**: failing loudly is defensible (everything downstream needs
the user name — silently degrading to a wrong name would split histories);
alternatively catch, notify via `UserNotifier`, and load with tracking
disabled. Pick one deliberately and document it.
