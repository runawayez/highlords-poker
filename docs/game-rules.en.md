[Português](./game-rules.md) | **English**

# House rules — highlords-nlhe-v1

These are explicit digital house rules, informed by [Poker TDA's current rules](https://www.pokertda.com/view-poker-tda-rules/) (checked 2026-11-09). This software does not claim certification or implement physical dealer procedures.

- Only virtual integer chips. No cash, monetary payouts, deposits or real prizes.
- Standard 52-card deck; rejection-sampled crypto RNG and Fisher–Yates; two hole cards each. Burn one before flop, turn and river. Best five of seven; ace can be low in a wheel.
- Button advances clockwise by one seat each round. Heads-up button posts SB and acts first preflop; BB acts first postflop. Per-player antes deduct from stacks independently of street bets.
- BB is the nominal minimum opening bet, even if the posted BB is all-in for less. Raises are expressed as **total street commitment**, not an increment. A full raise is at least the previous full increment. A short raise is allowed only for the player's entire remaining stack.
- A short all-in does not reopen raising for someone who already acted until cumulative increases faced equal a full raise. A checked player may raise an incomplete opening all-in. When facing an incomplete opening, the minimum completion is BB. Calling short is allowed, raising into a field with no other solvent player is not.
- All-in-only fields automatically run out the board. Uncalled excess stays with its owner; eligible contribution layers form side pots. Folded chips remain in pots. Each pot is evaluated separately. Odd chips go clockwise from the seat left of the button.
- Only non-folded showdown cards become public. A fold win never reveals hole cards. Completed histories never retain hidden cards. Spectators use the public projection with no private cards and no play actions. Showdown is live with no spectator delay; do not use this for real-money play.
- Turn timeout checks when legal and folds otherwise. Cash sit-out and resignations use the same automatic action when their turn arrives. A time bank can be spent once per turn; its configured balance is granted once on entry and does not refill each hand.
- The host starts all formats after at least two entrants. Sit & Go uses one table. Cash joins sit at the next hand boundary. Cash top-ups obey the configured bounds and enabled rebuy option and happen only between hands.
- Tournament entries pay virtual buy-in into a virtual prize pool and receive configured stack. Late registration is allowed only for multitable tournaments, while the zero-based current level is strictly below `lateLevels`. Rebuy requires zero stack, an available rebuy count and a level at or below `rebuyUntil`; each rebuy adds one entry amount to the virtual pool. Each add-on also adds one entry amount, is allowed once, between hands, at exactly `addOnLevel`, for a player with chips.
- Newly eliminated tournament players have at most 60 seconds to rebuy when eligible; the global round barrier waits. Without eligible pending rebuys, a sole survivor wins. Rebuys and late registration cannot reopen a finished event.
- Simultaneous eliminations at a barrier use stable player-ID ordering as a deterministic tie policy, rather than inferring cross-table finish times. Rankings are room-local. Abandoning/kicked players forfeit participation and cannot re-enter that room; use sit-out for a temporary absence in cash games. The host is not automatically reassigned.
- Prize pool awards: 50/30/20% to the top three for three or more ranked finishers; 70/30% for two; 100% for one. Integer remainder goes to the last paid place. No real value or transfers between rooms.
- Blind levels and optional timed breaks share a persisted elapsed clock. A break blocks new deals, not hands already in progress. The final level repeats indefinitely. Room pauses freeze both clocks and action deadlines.

Multi-table rounds deliberately share a hand barrier. This fairness/simplicity policy can make faster tables wait; it avoids moving anyone mid-hand or allowing chip duplication during partial transfers.
