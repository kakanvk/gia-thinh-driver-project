import bcrypt from 'bcryptjs';
import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { ROLES, type Role } from '../../config/roles';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface IUser {
  name: string;
  username: string;
  phone: string;
  email?: string;
  passwordHash: string;
  role: Role;
  branchIds: Types.ObjectId[];
  avatarMediaId?: Types.ObjectId | null;
  status: UserStatus;
  lastLoginAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  verifyPassword(password: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;
export type UserDoc = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    avatarMediaId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    lastLoginAt: { type: Date, default: null },
  },
  schemaOptions<IUser, IUserMethods>({ hidden: ['passwordHash'] }),
);

userSchema.plugin(softDeletePlugin);
userSchema.index({ role: 1, branchIds: 1 });

userSchema.method('verifyPassword', function verifyPassword(this: UserDoc, password: string) {
  return bcrypt.compare(password, this.passwordHash);
});

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export const User = model<IUser, UserModel>('User', userSchema);
