/**
 * Port for persisting and verifying refresh tokens.
 * The adapter (RedisTokenStoreAdapter) implements this using Redis.
 * TTL must match the JWT refresh token expiration (7 days = 604800 seconds).
 */
export interface TokenStorePort {
  /** Store a refresh token tied to a userId. Overwrites any previous value. */
  set(userId: string, refreshToken: string, ttlSeconds: number): Promise<void>;

  /** Return the stored refresh token for a userId, or null if absent / expired. */
  get(userId: string): Promise<string | null>;

  /** Delete the stored refresh token (logout / revocation). */
  delete(userId: string): Promise<void>;
}

export const TOKEN_STORE_PORT = 'TOKEN_STORE_PORT';
