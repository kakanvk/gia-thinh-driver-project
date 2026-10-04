import { afterEach, describe, expect, it, vi } from 'vitest';
import * as job from '../../src/modules/tuition/tuition.job';
import { TuitionAccount } from '../../src/modules/tuition/tuition-account.model';
import { JOB_INTERVAL_MS, startJobs, stopJobs } from '../../src/jobs';
import { parseDateOnly } from '../../src/shared/time';
import { createBranch, createCourse, createStudent } from '../helpers/factories';

async function account(dueDate: string, paidAmount = 0, total = 1_000_000) {
  const branch = await createBranch();
  const course = await createCourse();
  const student = await createStudent({ branchId: branch.id, courseId: course.id });
  await TuitionAccount.deleteMany({ studentId: student._id });
  return TuitionAccount.create({
    studentId: student._id,
    courseId: course._id,
    courseCode: course.code,
    branchId: branch._id,
    listPrice: total,
    total,
    installments: [{ dueDate: parseDateOnly(dueDate), amount: total }],
    paidAmount,
    status: 'partial',
  });
}

afterEach(async () => {
  await stopJobs();
  vi.useRealTimers();
});

describe('refreshTuitionStatuses', () => {
  it('đợt hạn hôm nay chưa quá hạn; sang 00:00 VN hôm sau thành overdue; đã đủ thì paid', async () => {
    const dueToday = await account('2026-10-05');
    const paidUp = await account('2026-09-01', 1_000_000);
    const first = await job.refreshTuitionStatuses(new Date('2026-10-05T16:59:00Z')); // 23:59 05/10 VN
    expect((await TuitionAccount.findById(dueToday.id))?.status).toBe('partial');
    expect((await TuitionAccount.findById(paidUp.id))?.status).toBe('paid');
    expect(first.changed).toBe(1);
    const second = await job.refreshTuitionStatuses(new Date('2026-10-05T17:00:00Z')); // 00:00 06/10 VN
    expect((await TuitionAccount.findById(dueToday.id))?.status).toBe('overdue');
    expect(second).toEqual({ checked: 1, changed: 1 });
    expect((await job.refreshTuitionStatuses(new Date('2026-10-05T17:00:00Z'))).changed).toBe(0);
  });
});

describe('refreshTuitionStatuses đồng thời', () => {
  it('thanh toán chen giữa lúc job đọc và ghi (status giữ nguyên partial) thì job không đè overdue', async () => {
    const acc = await account('2026-09-01', 0, 500_000);
    const realBulk = TuitionAccount.bulkWrite.bind(TuitionAccount);
    const spy = vi.spyOn(TuitionAccount, 'bulkWrite').mockImplementation(((...args: unknown[]) => {
      return TuitionAccount.updateOne({ _id: acc._id }, { $inc: { paidAmount: 500_000 }, status: 'partial' }).then(() =>
        (realBulk as (...a: unknown[]) => unknown)(...args),
      );
    }) as never);
    await job.refreshTuitionStatuses(new Date('2026-10-05T17:00:00Z'));
    spy.mockRestore();
    const after = (await TuitionAccount.findById(acc.id))!;
    expect(after.paidAmount).toBe(500_000);
    expect(after.status).toBe('partial');
  });
});

describe('refreshTuitionStatuses tự chữa paid sai', () => {
  it("sổ 'paid' nhưng chưa thu đủ được tính lại", async () => {
    const acc = await account('2026-09-01', 0, 500_000);
    await TuitionAccount.updateOne({ _id: acc._id }, { status: 'paid' });
    await job.refreshTuitionStatuses(new Date('2026-10-05T17:00:00Z'));
    expect((await TuitionAccount.findById(acc.id))?.status).toBe('overdue');
  });
});

describe('startJobs', () => {
  it('chạy sau 5 giây rồi mỗi 60 phút; stopJobs dừng hẳn', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(job, 'reconcilePaidAmounts').mockResolvedValue(0);
    const spy = vi.spyOn(job, 'refreshTuitionStatuses').mockResolvedValue({ checked: 0, changed: 0 });
    startJobs();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(JOB_INTERVAL_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    await stopJobs();
    await vi.advanceTimersByTimeAsync(JOB_INTERVAL_MS * 3);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
