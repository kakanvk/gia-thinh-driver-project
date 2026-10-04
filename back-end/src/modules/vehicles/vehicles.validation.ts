import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { atLeastOneField, objectIdSchema, transmissionSchema, zDateOnly } from '../../shared/zod';
import { VEHICLE_STATUSES } from './vehicle.model';

const PLATE = /^\d{2}[A-Z][A-Z0-9]?-(\d{3}\.\d{2}|\d{4,5})$/;

export function normalizePlate(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

const plateSchema = z
  .string()
  .transform(normalizePlate)
  .pipe(z.string().regex(PLATE, 'Biển số không hợp lệ (vd 64A-123.45)'));
const km = z.number().int().min(0).max(5_000_000);
const courseCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z0-9_]{1,10}$/, 'Mã hạng không hợp lệ'));

const fields = {
  plate: plateSchema,
  model: z.string().trim().min(2).max(100),
  courseCode: courseCodeSchema,
  transmission: transmissionSchema.optional(),
  odometer: km.optional(),
  datKm: km.optional(),
  lastServiceAt: zDateOnly.nullable().optional(),
  nextServiceAt: zDateOnly.nullable().optional(),
  registrationExpiresAt: zDateOnly.nullable().optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  note: z.string().trim().max(500).nullable().optional(),
};

export const createVehicleSchema = z.object({ ...fields, branchId: objectIdSchema });
export const updateVehicleSchema = atLeastOneField(z.object(fields).partial());
export const listVehiclesQuerySchema = listQuerySchema.extend({
  status: z.enum(VEHICLE_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
  courseCode: courseCodeSchema.optional(),
});
export const alertsQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;
