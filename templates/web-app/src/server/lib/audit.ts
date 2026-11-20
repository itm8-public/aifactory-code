import type { DbOrTx } from '../db/client';
import { auditLog } from '../db/schema';

export interface AuditEntry {
  actorId: string;
  action: 'create' | 'update' | 'delete' | (string & {});
  entity: string;
  entityId: string;
  /** Ids and changed field names. Never secrets or personal data. */
  detail?: Record<string, unknown>;
}

/** Writes one audit row. Call it with the same transaction as the change it records. */
export async function writeAudit(tx: DbOrTx, entry: AuditEntry) {
  await tx.insert(auditLog).values(entry);
}
