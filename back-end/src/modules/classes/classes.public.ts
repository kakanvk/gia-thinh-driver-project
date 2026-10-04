import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import { Branch } from '../branches/branch.model';
import { Course } from '../courses/course.model';
import { TrainingClass, type ITrainingClass } from './class.model';
import { seatCounts } from './classes.service';
import type { PublicClassesQuery } from './classes.validation';

export async function listUpcomingClasses(query: PublicClassesQuery) {
  const filter: FilterQuery<ITrainingClass> = { status: { $in: ['enrolling', 'upcoming'] } };
  const branches = await Branch.find({ status: 'active', ...(query.branch ? { slug: query.branch } : {}) });
  filter.branchId = { $in: branches.map((branch) => branch._id) };
  const activeCourses = await Course.find({ active: true, ...(query.course ? { code: query.course } : {}) });
  filter.courseId = { $in: activeCourses.map((course) => course._id) };
  const classes = await TrainingClass.find(filter).sort({ startDate: 1, _id: 1 }).limit(50);
  const counts = await seatCounts(classes.map((cls) => cls._id));
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const courseById = new Map(activeCourses.map((course) => [course.id, course]));
  return classes.flatMap((cls) => {
    const branch = branchById.get(cls.branchId.toString());
    const course = courseById.get(cls.courseId.toString());
    if (!branch || !course) return [];
    return [
      {
        code: cls.code,
        course: { code: course.code, name: course.name },
        transmission: cls.transmission,
        branch: { name: branch.name, slug: branch.slug },
        startDate: cls.startDate,
        endDate: cls.endDate,
        scheduleText: cls.scheduleText,
        seatsLeft: Math.max(0, cls.capacity - (counts.get(cls.id) ?? 0)),
        status: cls.status,
      },
    ];
  });
}

export async function upcoming(req: Request, res: Response): Promise<void> {
  sendData(res, await listUpcomingClasses(validated<PublicClassesQuery>(req, 'query')));
}
