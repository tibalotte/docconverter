/**
 * event-bus.js — Bus d'événements pub/sub minimal.
 *
 * Découple les modules : ils n'émettent et n'écoutent que des événements
 * normalisés (cf. docs/ARCHITECTURE.md §4.2). Aucun module n'importe un autre.
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Abonne un callback à un événement.
   * @returns {Function} fonction de désabonnement.
   */
  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
  }

  /** Émet un événement avec une charge utile optionnelle. */
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    // Copie défensive : un listener peut se désabonner pendant l'itération.
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[event-bus] listener pour "${event}" a levé :`, err);
      }
    }
  }
}

// Instance partagée par toute l'application.
export const bus = new EventBus();
