import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProviderUseCase } from '../create-provider.use-case';
import { ProviderRepository } from '../../../domain/repositories';
import { createProvider } from '../../../domain/test/factories';

describe('CreateProviderUseCase', () => {
  let mockRepo: ProviderRepository;
  let useCase: CreateProviderUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByName: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateProviderUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should return ok with provider data when name is unique', async () => {
      const result = await useCase.execute({
        name: 'Telefonica',
        adapterType: 'telefonica',
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().name).toBe('Telefonica');
      expect(result._unsafeUnwrap().adapterType).toBe('telefonica');
    });

    it('should persist the provider', async () => {
      await useCase.execute({ name: 'Telefonica', adapterType: 'telefonica' });

      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should return err when provider name already exists', async () => {
      mockRepo.findByName = vi.fn().mockResolvedValue(createProvider());

      const result = await useCase.execute({
        name: 'Telefonica',
        adapterType: 'telefonica',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('PROVIDER_ALREADY_EXISTS');
    });
  });
});
