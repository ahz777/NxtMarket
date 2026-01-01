const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');
const User = require('../users/user.model');

function signToken(user) {
  const payload = {
    sub: String(user._id),
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

async function register({ name, email, password, role }) {
  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) throw new ApiError(409, 'Email already registered');

  if (String(password).length < 8)
    throw new ApiError(400, 'Password must be at least 8 characters');

  const passwordHash = await bcrypt.hash(password, 12);

  const safeRole = role === 'vendor' ? 'vendor' : 'user';

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: safeRole,
  });

  const token = signToken(user);

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  };
}

async function login({ email, password }) {
  const normalizedEmail = String(email).toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  const token = signToken(user);

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  };
}

module.exports = { register, login };
