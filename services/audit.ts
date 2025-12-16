
import { db } from './db';
import { SystemRecord, ActionType, User } from '../types';

export const audit = {
  logAction: async (
    actor: User,
    action: ActionType,
    targetId?: string,
    targetName?: string,
    details?: string
  ) => {
    try {
      const record: SystemRecord = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name || 'Unknown',
        actorRole: actor.role,
        action,
        targetId,
        targetName,
        details
      };
      
      // Patch 2: Use getSecureItem/setSecureItem to bypass LocalStorage
      const logs = await db.getSecureItem<SystemRecord[]>('basis_system_records') || [];
      const updatedLogs = [record, ...logs];
      await db.setSecureItem('basis_system_records', updatedLogs);
    } catch (e) {
      console.error("Failed to log action:", e);
    }
  },

  getRecords: async (): Promise<SystemRecord[]> => {
    // Patch 2: Read strictly from cloud to prevent local spoofing/reading
    return await db.getSecureItem<SystemRecord[]>('basis_system_records') || [];
  },

  saveRecords: async (records: SystemRecord[]) => {
    await db.setSecureItem('basis_system_records', records);
  },

  clearAllRecords: async () => {
    await db.setSecureItem('basis_system_records', []);
  }
};
