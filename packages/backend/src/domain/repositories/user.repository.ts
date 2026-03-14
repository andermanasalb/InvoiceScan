import { User } from '../entities';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(role?: string): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
