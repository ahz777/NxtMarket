const ApiError = require('../../utils/ApiError');

const STATES = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  PARTIALLY_SHIPPED: 'PARTIALLY_SHIPPED',
  SHIPPED: 'SHIPPED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: new Set([STATES.PAID, STATES.CANCELLED]),
  PAID: new Set([STATES.PARTIALLY_SHIPPED, STATES.SHIPPED, STATES.CANCELLED, STATES.REFUNDED]),
  PARTIALLY_SHIPPED: new Set([STATES.SHIPPED, STATES.REFUNDED]),
  SHIPPED: new Set([STATES.REFUNDED]),
  CANCELLED: new Set([]),
  REFUNDED: new Set([]),
});

function assertTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) throw new ApiError(400, 'Invalid current order state');
  if (!allowed.has(to)) throw new ApiError(409, 'Invalid status transition', { from, to });
}

module.exports = { STATES, assertTransition };
