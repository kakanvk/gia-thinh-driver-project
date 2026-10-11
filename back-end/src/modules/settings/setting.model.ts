import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface ISetting {
  key: string;
  value: unknown;
  updatedBy?: Types.ObjectId | null;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  schemaOptions<ISetting>(),
);

export const Setting = model<ISetting>('Setting', settingSchema);
