const { DataTypes } = require('sequelize');

function defineAuditLog(sequelize) {
  return sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

      actorType: {
        type: DataTypes.ENUM('user', 'vendor', 'admin', 'webhook', 'system'),
        allowNull: false,
      },
      actorId: { type: DataTypes.STRING, allowNull: true },

      entityType: { type: DataTypes.STRING, allowNull: false },
      entityId: { type: DataTypes.STRING, allowNull: false },

      action: { type: DataTypes.STRING, allowNull: false },
      data: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'audit_logs', timestamps: true }
  );
}

module.exports = defineAuditLog;
