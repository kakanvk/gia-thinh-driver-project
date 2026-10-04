import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const EXAM_RESULTS = ['pending', 'passed', 'failed', 'absent'] as const;
export type ExamResult = (typeof EXAM_RESULTS)[number];

export interface IExamCandidate {
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  result: ExamResult;
  score: number | null;
  attempt: number;
  note?: string | null;
}

export type ExamCandidateDoc = HydratedDocument<IExamCandidate>;

const examCandidateSchema = new Schema<IExamCandidate>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ExamSession', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    result: { type: String, enum: EXAM_RESULTS, default: 'pending' },
    score: { type: Number, default: null, min: 0, max: 1000 },
    attempt: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IExamCandidate>(),
);

examCandidateSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
examCandidateSchema.index({ studentId: 1 });

export const ExamCandidate = model<IExamCandidate>('ExamCandidate', examCandidateSchema);
