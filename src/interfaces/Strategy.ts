export interface CreateStrategyDTO {
  name: string;
  description: string;
  file?: Express.Multer.File;
}

export interface UpdateStrategyDTO {
  name?: string;
  description?: string;
  file?: Express.Multer.File;
}

export interface StrategyResponse {
  id: string;
  name: string;
  description: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  averageMonthlyReturn?: number;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
  };
  connectedAccounts?: number;
} 