import { describe, it, expect } from 'vitest';
import { Provider } from '../provider.entity';
import { ProviderName } from '../../value-objects';

function makeValidProps() {
  return {
    id: 'prov-001',
    name: ProviderName.create('Telefonica')._unsafeUnwrap(),
    adapterType: 'telefonica',
    createdAt: new Date('2024-01-01'),
  };
}

describe('Provider', () => {
  describe('create', () => {
    it('should create a provider with valid props', () => {
      // Arrange & Act
      const result = Provider.create(makeValidProps());

      // Assert
      expect(result.isOk()).toBe(true);
      const provider = result._unsafeUnwrap();
      expect(provider.getId()).toBe('prov-001');
      expect(provider.getName().getValue()).toBe('Telefonica');
      expect(provider.getAdapterType()).toBe('telefonica');
    });

    it('should return error when id is empty', () => {
      // Arrange & Act
      const result = Provider.create({ ...makeValidProps(), id: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });

    it('should return error when adapterType is empty', () => {
      // Arrange & Act
      const result = Provider.create({ ...makeValidProps(), adapterType: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });
  });

  describe('immutability', () => {
    it('should not change id after creation', () => {
      // Arrange
      const provider = Provider.create(makeValidProps())._unsafeUnwrap();

      // Assert
      expect(provider.getId()).toBe('prov-001');
    });
  });
});
