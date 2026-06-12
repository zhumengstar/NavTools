const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const CREDENTIAL_PREFIX = 'navtools:v1:';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveCredentialKey(username: string, password: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: TEXT_ENCODER.encode(`navtools-site-credentials:${username}`),
      iterations: 150000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function createCredentialSecret(username: string, password: string): string {
  return `${username}\n${password}`;
}

function parseCredentialSecret(secret: string): { username: string; password: string } | null {
  const separatorIndex = secret.indexOf('\n');
  if (separatorIndex < 0) return null;
  return {
    username: secret.slice(0, separatorIndex),
    password: secret.slice(separatorIndex + 1),
  };
}

export async function encryptCredential(value: string, secret: string): Promise<string> {
  if (!value) return '';
  const parsed = parseCredentialSecret(secret);
  if (!parsed) {
    throw new Error('缺少用于加密的登录凭据');
  }

  const key = await deriveCredentialKey(parsed.username, parsed.password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    TEXT_ENCODER.encode(value)
  );

  return `${CREDENTIAL_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptCredential(value: string, secret: string): Promise<string> {
  if (!value) return '';
  const parsed = parseCredentialSecret(secret);
  if (!parsed) {
    throw new Error('缺少用于解密的登录凭据');
  }
  if (!value.startsWith(CREDENTIAL_PREFIX)) {
    return value;
  }

  const [ivBase64, encryptedBase64] = value.slice(CREDENTIAL_PREFIX.length).split(':');
  if (!ivBase64 || !encryptedBase64) {
    throw new Error('站点凭据密文格式无效');
  }

  const key = await deriveCredentialKey(parsed.username, parsed.password);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivBase64) },
    key,
    base64ToBytes(encryptedBase64)
  );

  return TEXT_DECODER.decode(decrypted);
}
