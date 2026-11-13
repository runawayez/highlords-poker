import type { LobbyEntry } from '../../contracts/src/index.ts';

/** Registro de salas públicas. Entradas que não renovam em 90 s somem; sala sem ninguém online não é listada. */
export const LOBBY_TTL_MS = 90_000;
export class LobbyRegistry {
  private entries = new Map<string, LobbyEntry>();
  constructor(initial: LobbyEntry[] = []) {
    for (const e of initial) this.entries.set(e.id, e);
  }
  put(entry: LobbyEntry) {
    this.entries.set(entry.id, entry);
  }
  remove(id: string) {
    this.entries.delete(id);
  }
  list(now = Date.now()): LobbyEntry[] {
    for (const [id, e] of this.entries) if (now - e.updated > LOBBY_TTL_MS) this.entries.delete(id);
    return [...this.entries.values()]
      .filter((e) => e.online > 0)
      .sort((a, b) => b.online - a.online || b.players - a.players || b.updated - a.updated);
  }
  snapshot() {
    return [...this.entries.values()];
  }
}
