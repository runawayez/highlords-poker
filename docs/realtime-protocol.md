# API and realtime protocol v1

All HTTP bodies are JSON, maximum 16 KiB. Responses have `Cache-Control: no-store`. Errors are `{ "error": "STABLE_CODE" }`, rendered through each client's local language catalog. Nicknames are display text, never authorization.

| Endpoint             | Contract                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `POST /api/session`  | `{profile}`; optional existing `Authorization: Bearer …`; returns new/existing token + playerId |
| `GET /api/lobby`     | Public summaries and recent global chat, without room hashes/decks                              |
| `POST /api/command`  | Authenticated `CommandSchema`: id, type, optional roomId/version, payload                       |
| `GET /api/rooms/:id` | Authenticated, joined member/spectator snapshot, private only to the holder                     |
| `GET /api/health`    | Liveness and versioned game-policy identifier                                                   |
| `GET /api/ws`        | WebSocket upgrade; first message `{type:"AUTH",token,roomId?}`                                  |

Lobby sockets omit roomId. Room sockets require membership. `PING` messages refresh durable presence; clients send them every 20 seconds. Server sends `{type:"SNAPSHOT",data}` periodically and `{type:"REFRESH"}` if room authorization changes. Unauthenticated sockets are closed after five seconds when the next adapter tick processes them. Reconnection obtains a fresh snapshot; there is no replay requirement because snapshots contain all public state and the requester's hole cards.

Commands: CREATE, JOIN, SPECTATE, LEAVE, START, PAUSE, RESUME, ACT, SIT_OUT, TOP_UP, ADD_ON, TIME_BANK, CHAT, REACT, MODERATE, REPORT, EXPORT. Game-affecting commands require the latest `version`; stale submissions receive STALE_VERSION and the client refreshes for review. JOIN/SPECTATE verify a supplied password on every entry. Cash JOIN can supply optional `buyIn`; otherwise the configured initial stack is used.

Every command needs a UUID `id`. Reusing an accepted ID in its retained room receipt window returns the original result without repeating the effect. Deduplication is bounded to the last 500 room commands; clients must not retry ancient commands outside that window. Different actors cannot consume one another's receipts. Rejected requests are not recorded as successes. Clients do not blindly retry uncertain game actions; reconnect and inspect state first.

The WebSocket transports snapshots only; commands go through HTTP. Credentials are never put in URLs. Origin allowlists protect browser HTTP and socket entry points; the credential and role/membership checks remain mandatory for native clients too.
