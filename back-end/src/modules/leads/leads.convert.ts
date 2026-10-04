import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { branchFilter } from '../../middlewares/authorize.middleware';
import { validated } from '../../middlewares/validate.middleware';
import { objectIdSchema, zDateOnly } from '../../shared/zod';
import { ApiError } from '../../utils/ApiError';
import { sendData } from '../../utils/response';
import { Student } from '../students/student.model';
import { createStudent, presentStudent } from '../students/students.service';
import { studentProfileFields } from '../students/students.validation';
import { Lead } from './lead.model';
import type { LeadStatus } from './lead.status';
import { addActivity } from './leads.activity';
import { getLead } from './leads.service';

export const CONVERTIBLE_STATUSES: LeadStatus[] = ['deposited', 'docs_completed'];

export const convertLeadSchema = z.object({
  courseId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
  email: studentProfileFields.email,
  dob: studentProfileFields.dob,
  idNumber: studentProfileFields.idNumber,
  address: studentProfileFields.address,
  note: studentProfileFields.note,
  enrolledAt: zDateOnly.optional(),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

export async function convertLead(
  actor: Express.AuthUser,
  scope: Express.BranchScope | undefined,
  id: string,
  input: ConvertLeadInput,
) {
  const lead = await getLead(scope, id);
  if (!CONVERTIBLE_STATUSES.includes(lead.status) || lead.studentId) {
    throw ApiError.conflict('Chỉ chuyển thành học viên khi khách đã đặt cọc hoặc hoàn tất hồ sơ');
  }
  const courseId = input.courseId ?? lead.courseId?.toString();
  if (!courseId) {
    throw ApiError.badRequest('Hãy chọn gói học cho học viên', [{ path: 'body.courseId', message: 'Bắt buộc' }]);
  }

  const student = await createStudent(actor, scope, {
    name: lead.name,
    phone: lead.phone,
    email: input.email ?? lead.email ?? undefined,
    dob: input.dob,
    idNumber: input.idNumber,
    address: input.address,
    note: input.note,
    courseId,
    branchId: lead.branchId.toString(),
    classId: input.classId,
    enrolledAt: input.enrolledAt,
    leadId: lead.id,
  });

  const at = new Date();
  let updated;
  try {
    updated = await Lead.findOneAndUpdate(
      { $and: [{ _id: lead._id, status: lead.status, studentId: null }, branchFilter(scope)] },
      { status: 'enrolled', studentId: student._id, lastActivityAt: at },
      { returnDocument: 'after' },
    );
  } catch (error) {
    try {
      await Student.deleteOne({ _id: student._id });
    } catch (cleanupError) {
      logger.error({ err: cleanupError, studentId: student.id }, 'Không xóa được học viên khi chuyển khách thất bại');
    }
    throw error;
  }
  if (!updated) {
    await Student.deleteOne({ _id: student._id });
    throw ApiError.conflict('Khách vừa được người khác cập nhật, vui lòng tải lại');
  }
  try {
    await addActivity(lead.id, {
      type: 'status_change',
      fromStatus: lead.status,
      toStatus: 'enrolled',
      content: `Chuyển thành học viên ${student.code}`,
      byUserId: actor.id,
      at,
    });
  } catch (error) {
    logger.error({ err: error, leadId: lead.id, studentId: student.id }, 'Không ghi được hoạt động chuyển học viên');
  }
  return { lead: updated, student: presentStudent(actor, student) };
}

export async function convert(req: Request, res: Response): Promise<void> {
  const { id } = validated<{ id: string }>(req, 'params');
  sendData(res, await convertLead(req.user!, req.scope, id, validated<ConvertLeadInput>(req, 'body')), 201);
}
