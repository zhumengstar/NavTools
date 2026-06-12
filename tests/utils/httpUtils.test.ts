import { describe, it, expect, vi } from 'vitest';
import { generateErrorId, MAX_BODY_SIZE, createJsonResponse } from '../../worker/utils/httpUtils';

describe('HTTP Utilities', () => {
    describe('generateErrorId', () => {
        it('should generate a valid UUID', () => {
            // Mock crypto.randomUUID if not available in testing env
            if (!globalThis.crypto) {
                globalThis.crypto = {
                    randomUUID: () => '123e4567-e89b-12d3-a456-426614174000'
                } as any;
            }
            
            const id = generateErrorId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });
    });

    describe('MAX_BODY_SIZE', () => {
        it('should be exactly 1MB (1024 * 1024)', () => {
            expect(MAX_BODY_SIZE).toBe(1048576);
        });
    });

    describe('createJsonResponse', () => {
        it('should create a response with correct headers and payload', async () => {
            const data = { success: true, message: 'test' };
            const response = createJsonResponse(data);
            
            expect(response.headers.get('Content-Type')).toBe('application/json');
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
            
            const text = await response.text();
            expect(JSON.parse(text)).toEqual(data);
        });
        
        it('should accept custom status codes', () => {
            const response = createJsonResponse({ error: 'not found' }, undefined, { status: 404 });
            expect(response.status).toBe(404);
        });
    });
});
