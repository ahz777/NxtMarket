const express = require('express');
const { validateBody } = require('../../middleware/validate');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/register', validateBody(['name', 'email', 'password']), controller.register);
router.post('/login', validateBody(['email', 'password']), controller.login);

module.exports = router;
