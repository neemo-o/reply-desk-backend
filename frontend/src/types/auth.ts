export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  emailVerified: boolean;
  createdAt?: string;
}

export type TenantRole = "owner" | "admin" | "agent";

export interface TenantSubscriptionSummary {
  status: string;
  plan?: string;
  isActive: boolean;
  trialUntil?: string | null;
  expiresAt?: string | null;
}

export interface MeTenant {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
  subscription: TenantSubscriptionSummary | null;
}

export interface MeSnapshot {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
  tenants: MeTenant[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
