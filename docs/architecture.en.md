[Português](./architecture.md) | **English**

# Architecture

## Authority and transaction boundary

The browser sends commands; it never supplies authoritative stacks, cards or winners. Shared Zod schemas validate inputs. `poker-engine` contains only TypeScript rules; the service supplies crypto-shuffled decks and projects each hand through `publicHand`.

A service instance holds a bounded club: at most 30 unexpired rooms, 500 anonymous sessions, 300 sockets across the adapter, 20 spectators per room, 90 entrants per tournament and 9 seats per table. Limits are admission controls, not measured capacity guarantees.

Each mutation runs in a FIFO transaction queue against a structured clone. The store must durably save the complete clone before it replaces the current state and before HTTP success. Failed validation or persistence discards the clone. Different rooms never share players' chip balances or decks.

The Node adapter uses SQLite WAL with `synchronous=FULL`, one row and one synchronous atomic upsert. Its single-process invariant is deliberate. The Cloudflare adapter uses **one SQLite-backed Durable Object per bounded club** and stores the same aggregate in its private Storage API. This differs from the brief's one-object-per-table proposal: a single bounded transaction domain makes table transfers, receipts and session authorization atomic without a distributed transfer protocol. See ADR 001. This is suitable for a private friends' club; it is not an internet-scale poker network.

## Tournament barrier

Tables can act concurrently through serialized commands. A new round begins after all hands finish and their eight-second review windows expire. Eligible players are balanced into `ceil(players/seats)` tables, differing in occupancy by at most one. Assignment plus stacks and new hands persist as one commit; a crash leaves either the old assignment or the new one, never half a transfer. A temporary one-player table waits at the barrier without paying blinds. Rebuy windows may hold the entire tournament barrier for up to 60 seconds.

## Identity and reconnection

The backend issues 256-bit random bearer credentials; only SHA-256 digests persist. One anonymous browser identity can join several rooms, each with its own membership and host check. This is a deliberate simplification of per-room tokens: room authorization is always checked separately. Credentials never appear in invite URLs, public views, preference exports or game history. Session expiry is seven days, extended when reopening/saving a profile. Membership and cards are restored from durable state.

The client authenticates a WebSocket in its first message, never its URL. Every socket receives a freshly authorized, filtered snapshot. HTTP commands receive the current snapshot through realtime updates or HTTP refresh; fallback polling runs when sockets are unavailable. Heartbeats record presence at most every 15 seconds. The lobby exposes only room summaries. Chat is restricted to room members.

## Clock and cleanup

The Node loop runs every two seconds. Worker alarms use five seconds while rooms or sockets are active and one minute when idle. Deadlines may be processed up to one tick late. Accepted commands set absolute turn deadlines; pause saves elapsed tournament time and shifts deadlines on resume. Blind changes apply to the next hand, never alter the current hand's stakes. Rooms pause after 60 seconds without any human participant or spectator heartbeat. Presence is scoped to each room; lobby heartbeats and server snapshot broadcasts never renew it.

Waiting, running and paused rooms expire after 30 minutes of absence following the 60-second presence timeout. A human returning before the deadline renews the reservation. Bots never renew presence. Finished rooms expire one hour after a fixed finishedAt timestamp; chat, exports and visits never extend it. Host-only CLOSE_ROOM removes the room immediately, with idempotent command receipts. Expiration clears game, chat, history and room membership while preserving sessions and other rooms. Minimal expired records are removed after one hour. Deadlines are enforced on reads and heartbeats as well as cleanup ticks, so an expired room cannot be revived between alarms. Legacy schema-1 rooms are upgraded from their last known human session timestamps on load. Chats retain at most 100 messages and one hour; hand history retains 30 hands; receipts retain 500 room commands. No indefinitely growing public ranking exists.

## Capacity brakes

Serialized state must remain below 6 MiB. At most 40,000 durable state writes per UTC day are accepted, independent of the adapter. A write above either brake is rejected before acknowledgment. Daily reset is computed on the next attempted mutation. The operator can also set `MAINTENANCE=true`. Provider quotas remain the ultimate upper bound; the app never upgrades a plan.
