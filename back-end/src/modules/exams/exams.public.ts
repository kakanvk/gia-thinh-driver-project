import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { validated } from '../../middlewares/validate.middleware';
import { startOfVnDay } from '../../shared/time';
import { sendData } from '../../utils/response';
import { Branch } from '../branches/branch.model';
import { Course } from '../courses/course.model';
import { ExamSession, type IExamSession } from './exam-session.model';
import type { PublicExamsQuery } from './exams.validation';

export async function listUpcomingExams(query: PublicExamsQuery) {
  const branches = await Branch.find({ status: 'active', ...(query.branch ? { slug: query.branch } : {}) });
  const courses = await Course.find({ active: true, ...(query.course ? { code: query.course } : {}) });
  const filter: FilterQuery<IExamSession> = {
    courseId: { $in: courses.map((course) => course._id) },
    status: 'scheduled',
    date: { $gte: startOfVnDay() },
    branchId: { $in: branches.map((branch) => branch._id) },
  };
  const sessions = await ExamSession.find(filter).sort({ date: 1, _id: 1 }).limit(50);
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  return sessions.flatMap((session) => {
    const branch = branchById.get(session.branchId.toString());
    const course = courseById.get(session.courseId.toString());
    if (!branch || !course) return [];
    return [
      {
        type: session.type,
        course: { code: course.code, name: course.name },
        branch: { name: branch.name, slug: branch.slug },
        date: session.date,
        location: session.location ?? null,
      },
    ];
  });
}

export async function upcoming(req: Request, res: Response): Promise<void> {
  sendData(res, await listUpcomingExams(validated<PublicExamsQuery>(req, 'query')));
}
