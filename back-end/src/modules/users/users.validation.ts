import { z } from 'zod';
import { ROLES } from '../../config/roles';
import { listQuerySchema, sortSchema } from '../../shared/mongoose/paginate';
import { objectIdSchema } from '../../shared/zod';
import { normalizePhone } from '../../utils/phone';
import { USER_STATUSES } from './user.model';

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/[A-Za-z]/, 'Mật khẩu phải có chữ cái')
  .regex(/\d/, 'Mật khẩu phải có chữ số');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9._]{3,30}$/, 'Tên đăng nhập 3–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới')
      .regex(/[a-z]/, 'Tên đăng nhập phải có ít nhất một chữ cái'),
  );

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số, bắt đầu bằng 0'));

const nameSchema = z.string().trim().min(2).max(100);
const branchIdsSchema = z.array(objectIdSchema).max(20);

export const createUserSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')).optional(),
  password: passwordSchema,
  role: z.enum(ROLES),
  branchIds: branchIdsSchema.default([]),
});

export const updateUserSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    phone: phoneSchema,
    email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')),
    role: z.enum(ROLES),
    branchIds: branchIdsSchema,
  })
  .partial();

export const userStatusSchema = z.object({ status: z.enum(USER_STATUSES) });

export const listUsersQuerySchema = listQuerySchema.extend({
  sort: sortSchema(['createdAt', 'name', 'username', 'role', 'status', 'lastLoginAt']),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserStatusInput = z.infer<typeof userStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
