// Sample script to import SQL seed data using Sequelize
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/config/sequelize');
const { Order } = require('../src/modules/orders/order.model');
const { OrderItem } = require('../src/modules/orders/orderItem.model');

async function seed() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/seed-sql.json')));
  await Order.destroy({ where: {} });
  await OrderItem.destroy({ where: {} });
  const createdOrders = [];
  for (const order of data.orders) {
    const newOrder = await Order.create(order);
    createdOrders.push(newOrder);
  }
  for (const item of data.orderItems) {
    await OrderItem.create({ ...item, orderId: createdOrders[item.orderIndex].id });
  }
  console.log('SQL seed data imported');
  process.exit();
}
seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
