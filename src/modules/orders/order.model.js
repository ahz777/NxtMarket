const { DataTypes } = require('sequelize');

function defineOrder(sequelize) {
  return sequelize.define(
    'Order',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM(
          'PENDING',
          'PAID',
          'PARTIALLY_SHIPPED',
          'SHIPPED',
          'CANCELLED',
          'REFUNDED'
        ),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    },
    { tableName: 'orders', timestamps: true }
  );
}

module.exports = defineOrder;
