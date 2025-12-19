const { DataTypes } = require('sequelize');

function defineOrderItem(sequelize) {
  return sequelize.define(
    'OrderItem',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.UUID, allowNull: false },
      productSku: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      qty: { type: DataTypes.INTEGER, allowNull: false },
      vendorId: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: 'order_items', timestamps: true }
  );
}

module.exports = defineOrderItem;
