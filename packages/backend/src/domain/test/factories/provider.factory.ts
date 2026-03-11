import { randomUUID } from 'crypto';
import { Provider, CreateProviderProps } from '../../entities/provider.entity';
import { ProviderName } from '../../value-objects';

const defaultProps = (): CreateProviderProps => ({
  id: randomUUID(),
  name: ProviderName.create(`Provider-${randomUUID()}`)._unsafeUnwrap(),
  adapterType: 'telefonica',
  createdAt: new Date('2025-01-15'),
});

export const createProvider = (overrides?: Partial<CreateProviderProps>): Provider => {
  const props = { ...defaultProps(), ...overrides };
  return Provider.create(props)._unsafeUnwrap();
};
