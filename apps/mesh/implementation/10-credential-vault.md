# Task 10: Credential Vault (Encryption)

## Overview
Implement credential encryption/decryption using AES-256-GCM for secure storage of connection tokens and OAuth secrets.

## Dependencies
- None (standalone crypto utility)

## Context from Spec

The vault encrypts sensitive credentials at rest:
- Connection tokens
- OAuth client secrets
- Downstream MCP tokens

Uses Node.js built-in crypto module with AES-256-GCM.

## Implementation Steps

### 1. Create CredentialVault class

**Location:** `apps/mesh/src/encryption/credential-vault.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * CredentialVault for encrypting/decrypting sensitive credentials
 * Uses AES-256-GCM for authenticated encryption
 */
export class CredentialVault {
  private key: Buffer;

  constructor(encryptionKey: string) {
    // Ensure key is exactly 32 bytes
    if (Buffer.from(encryptionKey, 'base64').length === KEY_LENGTH) {
      this.key = Buffer.from(encryptionKey, 'base64');
    } else {
      // Hash the key to get 32 bytes
      const crypto = require('crypto');
      this.key = crypto
        .createHash('sha256')
        .update(encryptionKey)
        .digest();
    }
  }

  /**
   * Encrypt a credential
   * Returns base64-encoded string containing IV + authTag + encrypted data
   */
  async encrypt(plaintext: string): Promise<string> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine: IV + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    return combined.toString('base64');
  }

  /**
   * Decrypt a credential
   * Expects base64-encoded string containing IV + authTag + encrypted data
   */
  async decrypt(ciphertext: string): Promise<string> {
    const combined = Buffer.from(ciphertext, 'base64');
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Generate a new random encryption key (base64-encoded 32 bytes)
   */
  static generateKey(): string {
    return randomBytes(KEY_LENGTH).toString('base64');
  }
}
```

### 2. Create vault initialization helper

```typescript
/**
 * Create CredentialVault from environment or generate new key
 */
export function createVault(): CredentialVault {
  let encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    console.warn(
      'ENCRYPTION_KEY not set! Generating random key. ' +
      'This means encrypted data will be unrecoverable after restart.'
    );
    encryptionKey = CredentialVault.generateKey();
  }
  
  return new CredentialVault(encryptionKey);
}
```

## File Locations

```
apps/mesh/src/
  encryption/
    credential-vault.ts    # CredentialVault class
```

## Testing

Create `apps/mesh/src/encryption/credential-vault.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CredentialVault } from './credential-vault';

describe('CredentialVault', () => {
  const testKey = CredentialVault.generateKey();
  const vault = new CredentialVault(testKey);

  describe('encrypt', () => {
    it('should encrypt plaintext', async () => {
      const plaintext = 'my-secret-token';
      const encrypted = await vault.encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different ciphertext each time', async () => {
      const plaintext = 'same-secret';
      const encrypted1 = await vault.encrypt(plaintext);
      const encrypted2 = await vault.encrypt(plaintext);
      
      // Different because of random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should return base64 string', async () => {
      const encrypted = await vault.encrypt('test');
      
      // Should be valid base64
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext back to plaintext', async () => {
      const plaintext = 'my-secret-token';
      const encrypted = await vault.encrypt(plaintext);
      const decrypted = await vault.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', async () => {
      const plaintext = 'token!@#$%^&*(){}[]<>?/:;\'"|\\+=~`';
      const encrypted = await vault.encrypt(plaintext);
      const decrypted = await vault.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', async () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = await vault.encrypt(plaintext);
      const decrypted = await vault.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw on invalid ciphertext', async () => {
      await expect(vault.decrypt('invalid-base64!!!')).rejects.toThrow();
    });

    it('should throw on tampered ciphertext', async () => {
      const plaintext = 'secret';
      const encrypted = await vault.encrypt(plaintext);
      
      // Tamper with the ciphertext
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 0xFF;
      const tampered = buffer.toString('base64');
      
      await expect(vault.decrypt(tampered)).rejects.toThrow();
    });
  });

  describe('different vaults', () => {
    it('should not decrypt with different key', async () => {
      const vault1 = new CredentialVault(CredentialVault.generateKey());
      const vault2 = new CredentialVault(CredentialVault.generateKey());
      
      const plaintext = 'secret';
      const encrypted = await vault1.encrypt(plaintext);
      
      // Different key = decryption fails
      await expect(vault2.decrypt(encrypted)).rejects.toThrow();
    });

    it('should decrypt with same key', async () => {
      const sharedKey = CredentialVault.generateKey();
      const vault1 = new CredentialVault(sharedKey);
      const vault2 = new CredentialVault(sharedKey);
      
      const plaintext = 'secret';
      const encrypted = await vault1.encrypt(plaintext);
      const decrypted = await vault2.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('generateKey', () => {
    it('should generate base64 key', () => {
      const key = CredentialVault.generateKey();
      
      expect(typeof key).toBe('string');
      expect(() => Buffer.from(key, 'base64')).not.toThrow();
    });

    it('should generate 32-byte key', () => {
      const key = CredentialVault.generateKey();
      const buffer = Buffer.from(key, 'base64');
      
      expect(buffer.length).toBe(32);
    });

    it('should generate different keys', () => {
      const key1 = CredentialVault.generateKey();
      const key2 = CredentialVault.generateKey();
      
      expect(key1).not.toBe(key2);
    });
  });
});
```

Run: `bun test apps/mesh/src/encryption/credential-vault.test.ts`

## Environment Variables

```bash
# Encryption key for credentials (32 bytes base64-encoded)
# Generate with: CredentialVault.generateKey()
ENCRYPTION_KEY=<base64-key>
```

If not set, a random key is generated at startup (data unrecoverable after restart).

## Validation

- [ ] Encrypts plaintext to ciphertext
- [ ] Decrypts ciphertext back to plaintext
- [ ] Each encryption produces unique ciphertext (random IV)
- [ ] Detects tampering (GCM auth tag)
- [ ] Different keys cannot decrypt
- [ ] Handles special characters and long strings
- [ ] generateKey produces valid 32-byte keys
- [ ] Tests pass

## Reference

See spec section: **Credential Isolation** (line 3407)

