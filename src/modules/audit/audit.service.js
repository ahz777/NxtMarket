async function writeAudit({ models, actorType, actorId, entityType, entityId, action, data }) {
  const { AuditLog } = models;
  if (!AuditLog) return;

  await AuditLog.create({
    actorType,
    actorId: actorId ? String(actorId) : null,
    entityType,
    entityId: String(entityId),
    action,
    data: data ?? null,
  });
}

module.exports = { writeAudit };
