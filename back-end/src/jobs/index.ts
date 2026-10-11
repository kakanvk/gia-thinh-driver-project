import { logger } from '../config/logger';
import * as tuitionJob from '../modules/tuition/tuition.job';

export const JOB_INTERVAL_MS = 60 * 60 * 1000;
export const JOB_START_DELAY_MS = 5000;

let startTimer: NodeJS.Timeout | null = null;
let intervalTimer: NodeJS.Timeout | null = null;
let inFlight: Promise<void> | null = null;

async function execute(): Promise<void> {
  try {
    const fixed = await tuitionJob.reconcilePaidAmounts();
    if (fixed) logger.warn({ fixed }, 'Đã sửa số đã thu lệch so với phiếu thu');
    const result = await tuitionJob.refreshTuitionStatuses();
    if (result.changed) logger.info(result, 'Đã cập nhật trạng thái học phí');
  } catch (err) {
    logger.error({ err }, 'Job cập nhật trạng thái học phí thất bại');
  }
}

function runAll(): Promise<void> {
  if (inFlight) return inFlight;
  const run = execute().finally(() => {
    if (inFlight === run) inFlight = null;
  });
  inFlight = run;
  return run;
}

export function startJobs(): void {
  clearTimers();
  startTimer = setTimeout(() => {
    void runAll();
    intervalTimer = setInterval(() => void runAll(), JOB_INTERVAL_MS);
    intervalTimer.unref();
  }, JOB_START_DELAY_MS);
  startTimer.unref();
}

function clearTimers(): void {
  if (startTimer) clearTimeout(startTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  startTimer = null;
  intervalTimer = null;
}

export async function stopJobs(): Promise<void> {
  clearTimers();
  if (inFlight) await inFlight;
}
