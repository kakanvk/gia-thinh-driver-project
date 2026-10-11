import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const VEHICLE_STATUSES = ['active', 'maintenance', 'paused'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export const TRANSMISSIONS = ['manual', 'automatic'] as const;

export interface IVehicle {
  plate: string;
  model: string;
  courseCode: string;
  transmission: (typeof TRANSMISSIONS)[number] | null;
  branchId: Types.ObjectId;
  odometer: number;
  datKm: number;
  lastServiceAt?: Date | null;
  nextServiceAt?: Date | null;
  registrationExpiresAt?: Date | null;
  status: VehicleStatus;
  note?: string | null;
  deletedAt?: Date | null;
}

export type VehicleDoc = HydratedDocument<IVehicle>;

const vehicleSchema = new Schema<IVehicle>(
  {
    plate: { type: String, required: true, uppercase: true, trim: true },
    model: { type: String, required: true, trim: true },
    courseCode: { type: String, required: true, uppercase: true, trim: true },
    transmission: { type: String, enum: [...TRANSMISSIONS, null], default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    odometer: { type: Number, default: 0, min: 0 },
    datKm: { type: Number, default: 0, min: 0 },
    lastServiceAt: { type: Date, default: null },
    nextServiceAt: { type: Date, default: null },
    registrationExpiresAt: { type: Date, default: null },
    status: { type: String, enum: VEHICLE_STATUSES, default: 'active' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IVehicle>(),
);

vehicleSchema.plugin(softDeletePlugin);
vehicleSchema.index({ branchId: 1, status: 1 });
// Plate is unique only among live vehicles, so a soft-deleted vehicle's plate can be reused.
// (`$type: 'null'` because partial indexes reject `{ deletedAt: null }`.)
vehicleSchema.index({ plate: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } });

export const Vehicle = model<IVehicle>('Vehicle', vehicleSchema);
