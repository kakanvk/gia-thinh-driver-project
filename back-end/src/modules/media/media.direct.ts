import express, { type Request, type RequestHandler, type Response } from 'express';
import { getStorage } from '../../shared/storage';
import { LocalStorageDriver } from '../../shared/storage/local';
import { ApiError } from '../../utils/ApiError';

function readRaw(req: Request, res: Response, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    express.raw({ type: () => true, limit })(req, res, (err?: unknown) => {
      if (err) {
        const status = (err as { status?: number; type?: string }).status;
        reject(status === 413 ? ApiError.payloadTooLarge('File vượt quá dung lượng cho phép') : err);
        return;
      }
      resolve(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
    });
  });
}

/**
 * `PUT /api/v1/media/direct/:token` — thay cho signed URL của GCS khi chạy driver local (test/offline).
 * Không qua `authenticate`: trình duyệt PUT theo URL ký sẵn, không kèm Bearer.
 */
export const directUpload: RequestHandler<{ token: string }> = async (req, res) => {
  const storage = getStorage();
  if (!(storage instanceof LocalStorageDriver)) throw ApiError.notFound();
  const claims = storage.verifyUploadToken(req.params.token);
  const contentType = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (contentType !== claims.contentType) throw ApiError.badRequest('Content-Type không khớp với liên kết tải lên');
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > claims.maxBytes) {
    throw ApiError.payloadTooLarge('File vượt quá dung lượng cho phép');
  }
  const body = await readRaw(req, res, claims.maxBytes);
  await storage.writeDirect(claims.key, body, claims.contentType);
  res.status(200).end();
};
