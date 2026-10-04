import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const TOKEN_TYPES = ['refresh'] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export interface IToken {
  userId: Types.ObjectId;
  tokenHash: string;
  type: TokenType;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const tokenSchema = new Schema<IToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    type: { type: String, enum: TOKEN_TYPES, required: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  schemaOptions<IToken>({ hidden: ['tokenHash'] }),
);

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Token = model<IToken>('Token', tokenSchema);
