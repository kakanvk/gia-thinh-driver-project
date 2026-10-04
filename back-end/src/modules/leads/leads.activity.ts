import type { ActivityType } from './lead-activity.model';
import { LeadActivity, type LeadActivityDoc } from './lead-activity.model';
import { Lead } from './lead.model';
import type { LeadStatus } from './lead.status';

export async function addActivity(
  leadId: string,
  entry: {
    type: ActivityType;
    content?: string | null;
    fromStatus?: LeadStatus | null;
    toStatus?: LeadStatus | null;
    byUserId: string | null;
    at?: Date;
  },
): Promise<LeadActivityDoc> {
  const at = entry.at ?? new Date();
  const activity = await LeadActivity.create({ ...entry, leadId, at });
  await Lead.updateOne({ _id: leadId }, { $max: { lastActivityAt: at } });
  return activity;
}
