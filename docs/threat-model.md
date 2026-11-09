# Security and abuse boundaries

## Protected boundaries

- Server owns deck generation, dealing, betting, evaluation and chip balances. `publicHand` is the only hand projection. Its deck and internal betting markers are never serialized publicly.
- A 256-bit token identifies a browser identity; only its SHA-256 digest is persisted. Session nicknames are not unique and grant no rights. Membership and host equality govern every room command.
- Room passwords use a unique 256-bit salt, PBKDF2-SHA256 with 100,000 iterations, and a length-safe comparison. Password hashes/salts are absent from public lobby/snapshots.
- Every accepted mutation persists first; the queue, version check and retained command receipts defend against races and repeated requests.
- Chat is React-rendered text, never HTML. Profile characters, color formats, icon selections, message sizes, config integers and command types are validated. No uploads, template execution, client-provided decks or payments.
- HTTP/WebSocket origins are allowlisted. Socket auth happens in the first message, not query strings. Payloads and backpressure are capped. Logs do not include secrets or game payloads.
- General HTTP limit is 120/minute per source IP; sessions 20/minute; joins/password attempts 12/minute; Node socket creation 30/minute per IP. Chat is one player message per 1.5 seconds. Room creation is capped at three active rooms per identity. There are hard club/session/spectator/connection caps and a durable daily write brake.

## Deliberate limitations

Anonymous identities can be replaced by clearing storage; mute/ban are room-scoped deterrents, not proof of a person's identity. In-memory IP buckets reset with process/isolate restarts and are not distributed identity controls. Node does not trust arbitrary X-Forwarded-For headers; behind a reverse proxy its rate limit may group users under the proxy IP. Cloudflare uses its platform IP header.

The operator controls the secret database and could inspect cards. Players can collude outside the app or share bearer credentials. Spectators see completed non-folded showdown cards without delay. Neither the software nor the local wins counter provides provably fair dealing, independent security certification, anti-collusion, real-money integrity or public ranking anti-fraud.

Use HTTPS/WSS for a public site and keep the local database/backup private. Browser storage theft/XSS/device access can steal bearer tokens; clearing browser storage intentionally loses anonymous recovery credentials. Prefer strict deployment headers, restricted operators and dependency review. The frontend includes no third-party script, remote font, advertising or telemetry. Source contains no live deployment secrets.
