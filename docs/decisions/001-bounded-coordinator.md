# ADR 001 — A bounded transactional club coordinator

Accepted 2026-11-09.

A tournament spans tables but must not duplicate a seat or chips during a crash. The first implementation uses a single durable transaction aggregate for a bounded club in both adapters. Each table still has a distinct hand/deck/turn and the poker engine remains infrastructure-independent.

Benefits: atomic rebalancing and deduplication, identical local/cloud behavior, straightforward fail-closed persistence. Costs: one serialization queue, aggregate rewrites and a club-wide capacity ceiling. Conservative caps and the 6 MiB brake make these constraints explicit.

Future sharding would require durable transfer intents, fencing tokens, idempotent receiving endpoints and recovery tests. Splitting into independent objects without that protocol would weaken the current correctness guarantee; it is not included or implied.
