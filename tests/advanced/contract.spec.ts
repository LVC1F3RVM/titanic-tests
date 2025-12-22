import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../src/config/constants';

test.describe('📜 Contract Testing (Schema Validation)', () => {

    test('Contract: GET /api/stats schema should match specification', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/stats`);
        expect(response.status()).toBe(200);
        const body = await response.json();

        // Строгая проверка типов (Contract)
        // Если разработчик изменит формат (например, average_fare станет строкой "$35.00"), тест упадет.
        
        expect(typeof body.total_passengers).toBe('number');
        
        // Проверка на null или number (так как age может быть null)
        const isAgeValid = typeof body.average_age === 'number' || body.average_age === null;
        expect(isAgeValid).toBeTruthy();
        
        expect(typeof body.average_fare).toBe('number');
        expect(typeof body.most_expensive_ticket).toBe('number');
        
        // Проверка типа строки или null
        const isDestValid = typeof body.most_popular_destination === 'string' || body.most_popular_destination === null;
        expect(isDestValid).toBeTruthy();
    });

    test('Contract: GET /api/passengers list item schema', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/passengers?limit=1`);
        const body = await response.json();
        
        if (body.length > 0) {
            const passenger = body[0];
            
            // Проверяем наличие и типы обязательных полей
            expect(typeof passenger.id).toBe('number');
            expect(typeof passenger.name).toBe('string');
            expect(typeof passenger.pclass).toBe('number');
            
            // Проверка Enum значений (pclass должен быть 1, 2 или 3)
            expect([1, 2, 3]).toContain(passenger.pclass);
            
            // Проверка формата цены
            expect(typeof passenger.fare).toBe('number');
        }
    });
});