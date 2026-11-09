# Persistence and recovery

State schema v1 contains sessions (hashed credentials), rooms (salted PBKDF2 passwords and per-room membership), protected hand state/decks, bounded events/history, tournament assignments and clocks, chat/moderation, receipts and the UTC write budget. Never publish the database or raw Durable Object state.

## Node/SQLite

Use Node 24 LTS, one server process and a durable volume for DATA_PATH. The adapter uses WAL, FULL synchronization and a single atomic upsert per accepted service transaction. On startup it reloads confirmed state. In-memory drafts never become public before save. If save fails, commands return INTERNAL/503 and discard their draft. Clock ticks fail closed too.

For a full secret backup, stop the server before copying the database (or use SQLite's online backup tooling). Copying only the main file while WAL is active is unsafe. Keep backups access-controlled and encrypted at rest in the operator's environment. To restore, stop the server, preserve the current database as a rollback copy, replace it with the chosen backup, and start one process. No public API imports arbitrary game snapshots.

The host's EXPORT command produces a **public audit record**, including host-visible moderation reports, not a secret disaster-recovery backup. It excludes tokens, password derivatives, unrevealed hole cards and remaining deck order. Treat player reports and chat as private club data when sharing that export.

## Cloudflare

`PokerCoordinator` is a SQLite-backed Durable Object declared in the v1 migration. Its private storage contains the same aggregate. Successful `storage.put` precedes command acknowledgment. Alarm deadlines survive hibernation. WebSocket attachments contain secret bearer credentials for reconnection authorization and remain server-side; no socket attachment is exposed to other clients.

Do not change/delete the object name, migration history, namespace binding or `highlords-v1` name to "reset" an active club. Those identify durable data. A future schema migration must be explicit, reversible where possible and tested against backups. The service rejects unsupported schemas instead of resetting silently.
