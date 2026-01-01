const { DataTypes } = require('sequelize');

function definePaymentIntent(sequelize) {
  return sequelize.define(
    'PaymentIntent',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

      orderId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.STRING, allowNull: false },

      provider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'stub' },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'USD' },

      status: {
        type: DataTypes.ENUM('REQUIRES_PAYMENT', 'SUCCEEDED', 'FAILED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'REQUIRES_PAYMENT',
      },

      clientSecret: { type: DataTypes.STRING, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'payment_intents', timestamps: true }
  );
}

module.exports = definePaymentIntent;
