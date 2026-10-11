import { model, Schema } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false },
);

export const Counter = model<ICounter>('Counter', counterSchema);

const MAX_ATTEMPTS = 3;

export async function nextSequence(key: string): Promise<number> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      return counter!.seq;
    } catch (err) {
      // Hai upsert đồng thời trên cùng _id mới: một request có thể lỗi 11000 → thử lại sẽ thấy document đã có.
      const duplicate = typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
      if (!duplicate || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}
