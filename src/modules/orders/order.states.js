const ApiError = require('../../utils/ApiError');

const STATES = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  SHIPPED: 'SHIPPED',
  CANCELLED: 'CANCELLED',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: new Set([STATES.PAID, STATES.CANCELLED]),
  PAID: new Set([STATES.SHIPPED, STATES.CANCELLED]),
  SHIPPED: new Set([]),
  CANCELLED: new Set([]),
});

function assertTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) throw new ApiError(400, 'Invalid current order state');
  if (!allowed.has(to)) {
    throw new ApiError(409, 'Invalid status transition', { from, to });
  }
}

module.exports = { STATES, assertTransition };
