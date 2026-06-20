import { describe, expect, it } from 'vitest';
import {
    createCredentialSecret,
    decryptCredential,
    encryptCredential,
} from '../../src/utils/credentialsCrypto';

describe('credentialsCrypto', () => {
    it('encrypts and decrypts credentials with the login secret', async () => {
        const secret = createCredentialSecret('alice', 'correct-horse-battery-staple');

        const encrypted = await encryptCredential('alice-password', secret);

        expect(encrypted).not.toBe('alice-password');
        expect(encrypted.startsWith('navtools:v1:')).toBe(true);
        await expect(decryptCredential(encrypted, secret)).resolves.toBe('alice-password');
    });
});
