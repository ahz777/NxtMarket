// Sample script to import MongoDB seed data
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../src/modules/products/product.model');
const User = require('../src/modules/users/user.model');

async function seed() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/seed-mongo.json')));
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany();
  await Product.deleteMany();
  for (const user of data.users) {
    await new User(user).save();
  }
  for (const product of data.products) {
    await new Product(product).save();
  }
  console.log('Mongo seed data imported');
  process.exit();
}
seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
