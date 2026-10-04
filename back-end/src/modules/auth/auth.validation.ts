import { z } from 'zod';
import { passwordSchema, phoneSchema } from '../users/users.validation';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập số điện thoại hoặc tên đăng nhập').max(100),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(200),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: phoneSchema.optional(),
    email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')).optional(),
  })
  .strip();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
