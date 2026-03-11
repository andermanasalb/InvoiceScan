export interface UserCredential {
  id: string;
  userId: string;
  passwordHash: string;
  createdAt: Date;
}

export interface UserCredentialRepository {
  findByUserId(userId: string): Promise<UserCredential | null>;
  save(credential: UserCredential): Promise<void>;
}
