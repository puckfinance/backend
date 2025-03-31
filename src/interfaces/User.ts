export interface User {
  id: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSignupDTO {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UserLoginDTO {
  email: string;
  password: string;
} 