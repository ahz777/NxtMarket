const mongoose = require('mongoose');
const { mongoUri } = require('./env');
mongoose
  .connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(console.error);
module.exports = mongoose;
