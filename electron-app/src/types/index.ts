export const UserRole = {
  PLAYER: 'player',
  COACH: 'coach',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  team: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SignUpData {
  username: string;
  email: string;
  password: string;
  role: string;
  team: string;
}