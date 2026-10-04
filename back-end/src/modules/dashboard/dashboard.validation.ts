import { z } from 'zod';
import { objectIdSchema } from '../../shared/zod';

const branch = { branchId: objectIdSchema.optional() };
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM');

export const dashboardScopeQuerySchema = z.object(branch);
export const registrationsQuerySchema = z.object({ ...branch, days: z.coerce.number().int().min(1).max(90).default(7) });
export const monthQuerySchema = z.object({ ...branch, month: monthSchema.optional() });
export const monthsQuerySchema = z.object({ ...branch, months: z.coerce.number().int().min(1).max(24).default(12) });

export type ScopeQuery = z.infer<typeof dashboardScopeQuerySchema>;
export type RegistrationsQuery = z.infer<typeof registrationsQuerySchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type MonthsQuery = z.infer<typeof monthsQuerySchema>;
