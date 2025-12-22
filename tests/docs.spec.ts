import { test, expect } from '@playwright/test';

// Список адресов документации (внутренние порты Docker проброшены на localhost)
const SWAGGER_URLS = [
    { name: 'Gateway', url: 'http://localhost:8000/docs' },
    { name: 'Auth Service', url: 'http://localhost:8003/docs' },
    { name: 'Passenger Service', url: 'http://localhost:8001/docs' },
    { name: 'Statistics Service', url: 'http://localhost:8002/docs' }
];

test.describe('📚 Documentation Availability', () => {
    for (const service of SWAGGER_URLS) {
        test(`${service.name} Swagger UI should be accessible`, async ({ request }) => {
            const response = await request.get(service.url);
            expect(response.status()).toBe(200);
            
            // Простая проверка, что вернулся HTML (а не JSON ошибки)
            const contentType = response.headers()['content-type'];
            expect(contentType).toContain('text/html');
        });
    }
});