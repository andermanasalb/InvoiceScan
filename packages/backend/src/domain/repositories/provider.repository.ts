import { Provider } from '../entities';

export interface ProviderRepository {
  findById(id: string): Promise<Provider | null>;
  findByName(name: string): Promise<Provider | null>;
  findAll(): Promise<Provider[]>;
  save(provider: Provider): Promise<void>;
}
