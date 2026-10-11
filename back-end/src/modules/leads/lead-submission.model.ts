import { model, Schema } from 'mongoose';

interface ILeadSubmission {
  phone: string;
  ip: string;
  at: Date;
}

const leadSubmissionSchema = new Schema<ILeadSubmission>(
  {
    phone: { type: String, required: true },
    ip: { type: String, default: '' },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

leadSubmissionSchema.index({ at: 1 }, { expireAfterSeconds: 86_400 });
leadSubmissionSchema.index({ phone: 1, at: -1 });

export const LeadSubmission = model<ILeadSubmission>('LeadSubmission', leadSubmissionSchema);
