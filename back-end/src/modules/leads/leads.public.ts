import type { Request, Response } from 'express';
import { z } from 'zod';
import { validated } from '../../middlewares/validate.middleware';
import { slugSchema } from '../../shared/zod';
import { ApiError } from '../../utils/ApiError';
import { sendData } from '../../utils/response';
import { Branch } from '../branches/branch.model';
import { Course } from '../courses/course.model';
import { phoneSchema } from '../users/users.validation';
import { LeadSubmission } from './lead-submission.model';
import { nextLeadCode } from './lead.code';
import { Lead } from './lead.model';
import { OPEN_STATUSES } from './lead.status';
import { addActivity } from './leads.activity';
import { utmSchema } from './leads.validation';

export const PHONE_DAILY_LIMIT = 3;
const DAY_MS = 86_400_000;

const optionalText = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

export const publicLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  email: optionalText(z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'))),
  branch: slugSchema,
  courseCode: optionalText(z.string().trim().toUpperCase().max(10)),
  preferredContactTime: optionalText(z.string().trim().max(100)),
  note: optionalText(z.string().trim().max(1000)),
  consent: z.literal(true, { message: 'Bạn cần đồng ý để Gia Thịnh liên hệ tư vấn' }),
  website: z.string().max(200).optional(),
  utm: utmSchema.optional(),
});

export type PublicLeadInput = z.infer<typeof publicLeadSchema>;

function describeSubmission(input: PublicLeadInput): string {
  return [
    'Khách gửi lại form tư vấn trên website',
    input.courseCode ? `Hạng: ${input.courseCode}` : null,
    input.preferredContactTime ? `Liên hệ: ${input.preferredContactTime}` : null,
    input.note ? `Nội dung: ${input.note}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export async function submitPublicLead(input: PublicLeadInput, ip: string): Promise<void> {
  if (input.website) return;

  const recent = await LeadSubmission.countDocuments({ phone: input.phone, at: { $gt: new Date(Date.now() - DAY_MS) } });
  if (recent >= PHONE_DAILY_LIMIT) {
    throw new ApiError(429, 'RATE_LIMITED', 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau hoặc gọi hotline');
  }

  const branch = await Branch.findOne({ slug: input.branch, status: 'active' });
  if (!branch) throw ApiError.badRequest('Cơ sở không hợp lệ', [{ path: 'body.branch', message: 'Không tồn tại' }]);
  const course = input.courseCode ? await Course.findOne({ code: input.courseCode, active: true }) : null;
  if (input.courseCode && !course) {
    throw ApiError.badRequest('Hạng bằng không hợp lệ', [{ path: 'body.courseCode', message: 'Không tồn tại' }]);
  }

  await LeadSubmission.create({ phone: input.phone, ip, at: new Date() });

  const existing = await Lead.findOne({ phone: input.phone, branchId: branch._id, status: { $in: OPEN_STATUSES } }).sort({
    createdAt: -1,
  });
  if (existing) {
    await addActivity(existing.id, { type: 'form_resubmit', content: describeSubmission(input), byUserId: null });
    return;
  }

  const lead = await Lead.create({
    code: await nextLeadCode(),
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    branchId: branch._id,
    courseId: course?._id ?? null,
    courseCode: course?.code ?? null,
    preferredContactTime: input.preferredContactTime ?? null,
    note: input.note ?? null,
    source: 'website',
    utm: input.utm ?? null,
    status: 'new',
    lastActivityAt: new Date(),
  });
  await addActivity(lead.id, { type: 'created', content: 'Khách gửi form tư vấn trên website', byUserId: null });
}

export async function submit(req: Request, res: Response): Promise<void> {
  await submitPublicLead(validated<PublicLeadInput>(req, 'body'), req.ip ?? '');
  sendData(res, { received: true }, 201);
}
