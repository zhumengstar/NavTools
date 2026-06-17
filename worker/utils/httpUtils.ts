export function generateErrorId(): string {
    return crypto.randomUUID();
}

export interface LogData {
    timestamp?: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    errorId?: string;
    path?: string;
    method?: string;
    details?: unknown;
}

export function log(data: LogData): void {
    console.log(JSON.stringify({
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
    }));
}

export function createJsonResponse(
    data: any,
    request?: Request | null,
    options: ResponseInit = {}
): Response {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    
    // Add CORS headers by default for standard responses
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(JSON.stringify(data), { ...options, headers });
}

export function createErrorResponse(
    error: unknown,
    request: Request,
    context?: string
): Response {
    const errorId = generateErrorId();
    const url = new URL(request.url);

    log({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        errorId,
        path: url.pathname,
        method: request.method,
        details: error instanceof Error ? {
            name: error.name,
            stack: error.stack,
        } : error,
    });

    return createJsonResponse(
        {
            success: false,
            message: context ? `${context} failed` : 'An error occurred',
            errorId,
        },
        request,
        { status: 500 }
    );
}

export const MAX_BODY_SIZE = 1024 * 1024; // 1MB

export async function validateRequestBody(request: Request): Promise<unknown> {
    const contentLength = request.headers.get('Content-Length');

    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        throw new Error('Request body too large, max 1MB allowed');
    }

    const clonedRequest = request.clone();
    const bodyText = await clonedRequest.text();

    if (bodyText.length > MAX_BODY_SIZE) {
        throw new Error('Request body too large, max 1MB allowed');
    }

    try {
        return JSON.parse(bodyText);
    } catch {
        throw new Error('Invalid JSON format');
    }
}
