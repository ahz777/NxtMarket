const { DataTypes } = require('sequelize');

function defineIdempotencyKey(sequelize) {
  return sequelize.define(
    'IdempotencyKey',
    {
      key: { type: DataTypes.STRING(128), primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      endpoint: { type: DataTypes.STRING, allowNull: false },
      requestHash: { type: DataTypes.STRING(64), allowNull: true },
      response: { type: DataTypes.JSONB, allowNull: true },
      statusCode: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'idempotency_keys', timestamps: true }
  );
}

module.exports = defineIdempotencyKey;
