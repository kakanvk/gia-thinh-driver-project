import type { FilterQuery } from 'mongoose';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { TrainingClass } from '../classes/class.model';
import { ExamSession } from '../exams/exam-session.model';
import { Student } from '../students/student.model';
import { Vehicle } from '../vehicles/vehicle.model';
import { Course, type CourseDoc, type ICourse } from './course.model';
import type { CreateCourseInput, ListCoursesQuery, UpdateCourseInput } from './courses.validation';

type Actor = Express.AuthUser;

export async function listCourses(query: ListCoursesQuery) {
  const filter: FilterQuery<ICourse> = {};
  if (query.active !== undefined) filter.active = query.active;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ code: pattern }, { name: pattern }];
  }
  return paginate(Course, filter, query, 'order');
}

export async function getCourse(id: string): Promise<CourseDoc> {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Không tìm thấy gói học');
  return course;
}

async function assertCodeFree(code: string, exceptId?: string): Promise<void> {
  const taken = await Course.exists({ code, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Mã gói đã tồn tại', [{ path: 'body.code', message: 'Đã tồn tại' }]);
}

export async function createCourse(actor: Actor, input: CreateCourseInput): Promise<CourseDoc> {
  await assertCodeFree(input.code);
  const course = await Course.create(input);
  await recordAudit({
    actorId: actor.id,
    action: 'course.create',
    entity: 'course',
    entityId: course.id,
    after: snapshot(course),
  });
  return course;
}

export async function updateCourse(actor: Actor, id: string, input: UpdateCourseInput): Promise<CourseDoc> {
  const course = await getCourse(id);
  if (input.code && input.code !== course.code) {
    await assertCodeFree(input.code, id);
    const inUse = await Promise.all([
      TrainingClass.exists({ courseId: course._id }),
      Student.exists({ courseId: course._id }),
      ExamSession.exists({ courseId: course._id }),
      Vehicle.exists({ courseCode: course.code }),
    ]);
    if (inUse.some(Boolean)) {
      throw ApiError.conflict('Mã gói đang được dùng ở lớp/học viên/ca thi/xe, không thể đổi mã');
    }
  }
  const before = snapshot(course);
  course.set(input);
  await course.save();
  await recordAudit({
    actorId: actor.id,
    action: 'course.update',
    entity: 'course',
    entityId: id,
    before,
    after: snapshot(course),
  });
  return course;
}

export async function removeCourse(actor: Actor, id: string): Promise<void> {
  const course = await getCourse(id);
  const before = snapshot(course);
  course.deletedAt = new Date();
  await course.save();
  await recordAudit({ actorId: actor.id, action: 'course.delete', entity: 'course', entityId: id, before });
}

export async function reorderCourses(actor: Actor, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if ((await Course.countDocuments({ _id: { $in: unique } })) !== unique.length) {
    throw ApiError.badRequest('Có gói học không tồn tại', [{ path: 'body.ids', message: 'Không tồn tại' }]);
  }
  await Course.bulkWrite(unique.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { order: index } } })));
  await recordAudit({ actorId: actor.id, action: 'course.reorder', entity: 'course', entityId: 'all', after: unique });
}
