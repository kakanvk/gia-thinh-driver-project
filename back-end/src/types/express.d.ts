import type { Role } from '../config/roles';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      role: Role;
      branchIds: string[];
    }

    interface BranchScope {
      all: boolean;
      branchIds: string[];
    }

    interface Request {
      user?: AuthUser;
      valid?: { body?: unknown; query?: unknown; params?: unknown };
      scope?: BranchScope;
    }
  }
}

export {};
