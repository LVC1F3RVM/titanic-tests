import { test, expect } from '@playwright/test';
import { BASE_URL, NEW_PASSENGER } from '../../src/config/constants';
import { getAuthToken } from '../../src/utils/auth.helper';

test.describe('🛡️ Advanced: Boundary & Security Tests', () => {
    let userToken: string;

    test.beforeAll(async ({ request }) => {
        userToken = await getAuthToken(request, {
            username: `hacker_${Date.now()}`,
            password: 'password123',
            email: `hacker_${Date.now()}@test.com`
        });
    });

    // === Граничные значения (Boundary Testing) ===
    
    test('Boundary: Should reject Age < 0', async ({ request }) => {
        const invalidData = { ...NEW_PASSENGER, age: -1 };
        const response = await request.post(`${BASE_URL}/api/passengers`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: invalidData
        });
        // FastAPI/Pydantic должен вернуть 422 (Unprocessable Entity)
        expect(response.status()).toBe(422);
    });

    test('Boundary: Should reject Age > 150', async ({ request }) => {
        const invalidData = { ...NEW_PASSENGER, age: 151 };
        const response = await request.post(`${BASE_URL}/api/passengers`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: invalidData
        });
        expect(response.status()).toBe(422);
    });

    test('Boundary: Should reject empty name', async ({ request }) => {
        const invalidData = { ...NEW_PASSENGER, name: "" };
        const response = await request.post(`${BASE_URL}/api/passengers`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: invalidData
        });
        // Pydantic обычно требует min_length=1
        expect(response.status()).toBe(422);
    });

    test('Boundary: Should handle huge payload (Buffer Overflow attempt)', async ({ request }) => {
        const hugeName = "A".repeat(10000); // Строка в 10кб
        const invalidData = { ...NEW_PASSENGER, name: hugeName };
        
        const response = await request.post(`${BASE_URL}/api/passengers`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: invalidData
        });
        
        // Сервер должен либо вернуть 422 (если есть ограничение), либо 201 (если нет),
        // но НЕ должен упасть с 500 ошибкой.
        expect(response.status()).not.toBe(500);
    });

    // === Тестирование безопасности (Security Testing) ===

    test('Security: XSS Injection attempt in Name', async ({ request }) => {
        const xssPayload = "<script>alert('HACKED')</script>";
        const xssData = { ...NEW_PASSENGER, name: xssPayload };

        const response = await request.post(`${BASE_URL}/api/passengers`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: xssData
        });

        // API может сохранить это (201), это нормально для Backend-API.
        // Главное, чтобы при чтении мы получили это как строку, а не исполняемый код.
        // (В контексте API теста мы проверяем, что сервер не падает и отдает JSON).
        expect(response.status()).toBe(201);
        
        const body = await response.json();
        expect(body.name).toBe(xssPayload); 
        // Примечание: Если бы у нас был UI тест, мы бы проверяли, что алерт НЕ выскочил.
    });

    test('Security: SQL Injection attempt in ID (GET)', async ({ request }) => {
        // Пытаемся передать SQL инъекцию вместо ID
        const response = await request.get(`${BASE_URL}/api/passengers/1' OR '1'='1`);
        
        // FastAPI автоматически валидирует типы URL параметров.
        // Так как id должен быть int, сервер должен вернуть 422 или 404, но не 500.
        expect(response.status()).not.toBe(500);
        // Скорее всего будет 422, так как строка не парсится в int
        expect([404, 422]).toContain(response.status());
    });
});