// ═══════════════════════════════════════════════════════
// MetroMatrix — the live connection's names
// ═══════════════════════════════════════════════════════
// The socket.io namespace, the room-join event and every event the app
// listens to, in one place. Only this file names them.
//
// TODO(API_FOOD): taken from the Food API's plan (namespace /food, rooms
// joined with `subscribe { orderId }`, events below); check every name
// against MetroMatrix-API docs/API_FOOD.md when it is published.

export const REALTIME_NAMESPACE = '/food';
export const REALTIME_PATH = '/socket.io';

/** Client → server, acked `{ ok, code? }`. */
export const REALTIME_JOIN = {
  subscribe: 'subscribe',
  unsubscribe: 'unsubscribe',
} as const;

/** Server → client. */
export const REALTIME_EVENTS = {
  orderNew: 'order.new',
  orderUpdated: 'order.updated',
  orderPayment: 'order.payment',
  riderLocation: 'rider.location',
  boardSync: 'board.sync',
} as const;

/** Client → server: the rider's fixes (acked). */
export const REALTIME_SEND = {
  riderLocation: 'rider.location',
} as const;

/** connect_error codes that mean "refresh the access token, then reconnect". */
export const REALTIME_AUTH_CODES = ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'TOKEN_REVOKED'];

/** The server says the token is about to lapse; the client refreshes and reconnects. */
export const REALTIME_AUTH_EXPIRED = 'auth.expired';
