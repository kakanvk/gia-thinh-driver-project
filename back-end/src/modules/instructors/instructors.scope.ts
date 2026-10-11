import type { Types } from 'mongoose';
import { Instructor } from './instructor.model';

/** Hồ sơ giáo viên gắn với tài khoản (dùng để thu hẹp dữ liệu cho vai trò instructor). */
export async function instructorIdsOfUser(userId: string): Promise<Types.ObjectId[]> {
  const profiles = await Instructor.find({ userId }).select('_id');
  return profiles.map((profile) => profile._id);
}
