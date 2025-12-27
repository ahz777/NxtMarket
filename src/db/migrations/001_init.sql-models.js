/**
 * Initial schema for NxtMarket SQL side.
 * Tables:
 *  - orders
 *  - order_items
 *  - idempotency_keys
 *  - payment_intents
 *  - audit_logs
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const { DataTypes } = require('sequelize');

    // orders
    await queryInterface.createTable('orders', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
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
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    // order_items
    await queryInterface.createTable('order_items', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      orderId: { type: DataTypes.UUID, allowNull: false },
      productSku: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      qty: { type: DataTypes.INTEGER, allowNull: false },
      vendorId: { type: DataTypes.STRING, allowNull: false },
      fulfillmentStatus: {
        type: DataTypes.ENUM('PENDING', 'SHIPPED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      shippedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('order_items', ['orderId']);
    await queryInterface.addIndex('order_items', ['vendorId']);
    await queryInterface.addIndex('order_items', ['orderId', 'vendorId']);

    // idempotency_keys
    await queryInterface.createTable('idempotency_keys', {
      key: { type: DataTypes.STRING(128), primaryKey: true, allowNull: false },
      userId: { type: DataTypes.STRING, allowNull: false },
      endpoint: { type: DataTypes.STRING, allowNull: false },
      requestHash: { type: DataTypes.STRING(64), allowNull: true }, // sha256 hex
      response: { type: DataTypes.JSONB, allowNull: true },
      statusCode: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('idempotency_keys', ['userId', 'endpoint']);

    // payment_intents
    await queryInterface.createTable('payment_intents', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
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
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('payment_intents', ['orderId']);
    await queryInterface.addIndex('payment_intents', ['userId']);

    // audit_logs
    await queryInterface.createTable('audit_logs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      actorType: {
        type: DataTypes.ENUM('user', 'vendor', 'admin', 'webhook', 'system'),
        allowNull: false,
      },
      actorId: { type: DataTypes.STRING, allowNull: true },

      entityType: { type: DataTypes.STRING, allowNull: false }, // e.g. "order", "payment_intent"
      entityId: { type: DataTypes.STRING, allowNull: false },

      action: { type: DataTypes.STRING, allowNull: false }, // e.g. "order.status_changed"
      data: { type: DataTypes.JSONB, allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('audit_logs', ['entityType', 'entityId']);
    await queryInterface.addIndex('audit_logs', ['actorType', 'actorId']);
  },

  down: async ({ context: queryInterface }) => {
    // Drop tables first
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('payment_intents');
    await queryInterface.dropTable('idempotency_keys');
    await queryInterface.dropTable('order_items');
    await queryInterface.dropTable('orders');

    // Drop ENUM types created by Sequelize (Postgres)
    // These names are the default Sequelize enum type names for the tables above.
    const dropEnum = async (name) => {
      try {
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${name}";`);
      } catch (_) {}
    };

    await dropEnum('enum_orders_status');
    await dropEnum('enum_order_items_fulfillmentStatus');
    await dropEnum('enum_payment_intents_status');
    await dropEnum('enum_audit_logs_actorType');
  },
};
