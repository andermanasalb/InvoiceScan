import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogoutUseCase } from '../logout.use-case';
import { TokenStorePort } from '../../ports/token-store.port';

describe('LogoutUseCase', () => {
  let tokenStore: TokenStorePort;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    tokenStore = {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new LogoutUseCase(tokenStore);
  });

  describe('execute', () => {
    it('should delete the refresh token from the store', async () => {
      const result = await useCase.execute({ userId: 'user-uuid-123' });

      expect(result.isOk()).toBe(true);
      expect(tokenStore.delete).toHaveBeenCalledOnce();
      expect(tokenStore.delete).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should succeed even if no token was stored (idempotent)', async () => {
      // delete on a non-existent key does nothing — still ok
      tokenStore.delete = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute({ userId: 'non-existent-user' });

      expect(result.isOk()).toBe(true);
    });
  });
});
