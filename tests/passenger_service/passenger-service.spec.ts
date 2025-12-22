import { test, expect } from '@playwright/test';
import { BASE_URL, NEW_PASSENGER } from '../../src/config/constants';
import { getAuthToken } from '../../src/utils/auth.helper';

test.describe('🚢 Passenger Service Integration Tests', () => {
    let adminToken: string;
    let userToken: string;

    test.beforeAll(async ({ request }) => {
        // 1. Admin Token (для DELETE)
        adminToken = await getAuthToken(request, {
            username: 'admin',
            password: 'admin123',
            email: 'admin@titanic.com'
        });

        // 2. User Token (для обычных операций)
        userToken = await getAuthToken(request, {
            username: `user_${Date.now()}`,
            password: 'password123',
            email: `user_${Date.now()}@test.com`
        });
    });

    // === Блок 1: Публичные операции (GET) ===
    test.describe('1. Public Read Operations', () => {
        
        test('GET /passengers - Should list passengers with pagination', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/passengers`, {
                params: { limit: 10, offset: 0 }
            });
            expect(response.status()).toBe(200);
            
            const list = await response.json();
            expect(Array.isArray(list)).toBeTruthy();
            expect(list.length).toBeLessThanOrEqual(10);
            
            if (list.length > 0) {
                const p = list[0];
                expect(p).toHaveProperty('id');
                expect(p).toHaveProperty('name');
                expect(p).toHaveProperty('pclass');
            }
        });

        test('GET /passengers - Should filter by parameters', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/passengers`, {
                params: { pclass: 1, sex: 'female' }
            });
            expect(response.status()).toBe(200);
            
            const list = await response.json();
            list.forEach((p: any) => {
                expect(p.pclass).toBe(1);
                expect(p.sex).toBe('female');
            });
        });

        test('GET /passengers - Should validate filter params', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/passengers`, {
                params: { sex: 'unknown_gender' }
            });
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body.detail).toBe("sex must be 'male' or 'female'");
        });
    });

    // === Блок 2: Защищенные операции (CRUD) ===
    test.describe('2. Secure CRUD Operations', () => {
        // ВАЖНО: Включаем serial режим!
        // Это гарантирует, что тесты внутри этого блока будут выполняться СТРОГО по порядку.
        // Create -> Read -> Update -> Delete
        test.describe.configure({ mode: 'serial' });

        let createdId: number;

        test('POST /passengers - Should create passenger (User role)', async ({ request }) => {
            const response = await request.post(`${BASE_URL}/api/passengers`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                data: NEW_PASSENGER
            });

            expect(response.status()).toBe(201);
            const body = await response.json();
            createdId = body.id; // Сохраняем ID для следующих тестов

            expect(body.name).toBe(NEW_PASSENGER.name);
            expect(body.created_by).toBeDefined(); 
        });

        test('GET /passengers/{id} - Should retrieve created passenger', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/passengers/${createdId}`);
            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body.id).toBe(createdId);
        });

        test('PUT /passengers/{id} - Should update passenger (User role)', async ({ request }) => {
            const updatedData = { ...NEW_PASSENGER, fare: 150.00 };
            const response = await request.put(`${BASE_URL}/api/passengers/${createdId}`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                data: updatedData
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body.fare).toBe(150.00);
        });

        test('DELETE /passengers/{id} - Should fail for non-admin User', async ({ request }) => {
            const response = await request.delete(`${BASE_URL}/api/passengers/${createdId}`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            expect(response.status()).toBe(403);
            const body = await response.json();
            expect(body.detail).toContain("Admin access required. Only administrators can perform this action.");
        });

        test('DELETE /passengers/{id} - Should succeed for Admin', async ({ request }) => {
            const response = await request.delete(`${BASE_URL}/api/passengers/${createdId}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            expect([200, 204]).toContain(response.status());

            const check = await request.get(`${BASE_URL}/api/passengers/${createdId}`);
            expect(check.status()).toBe(404);
        });
    });

    // === Блок 3: Пасхалки и Бизнес-логика ===
    test.describe('3. Business Logic & Easter Eggs', () => {
        
        test('Search - Should find Jack', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/passengers/search`, {
                params: { name: 'Jack' }
            });
            expect(response.status()).toBe(200);
            const list = await response.json();
            expect(list.length).toBeGreaterThan(0);
            expect(list[0].name).toContain('Jack');
        });

        test('Easter Egg - Jack and Rose cannot share a cabin', async ({ request }) => {
            const roseData = { name: "DeWitt Bukater, Miss. Rose",
                pclass: 1,
                sex: "female",
                age: 17,
                fare: 211.34,
                embarked: "Southampton",
                destination: "New York",
                cabin: "B52",
                ticket: "PC 17599"
            };

            // Создаем Розу (Admin)
            await request.post(`${BASE_URL}/api/passengers`, {
                headers: { 'Authorization': `Bearer ${adminToken}` },
                data: roseData
            });

            // Пытаемся создать Джека в каюте Розы
            const jackSneakingIn = {
                name: "Dawson, Mr. Jack",
                pclass: 3,
                sex: "male",
                age: 20,
                fare: 0.0,
                embarked: "Southampton",
                destination: "America",
                cabin: "B52", 
                ticket: "A/5 21171"
            };

            const response = await request.post(`${BASE_URL}/api/passengers`, {
                headers: { 'Authorization': `Bearer ${adminToken}` },
                data: jackSneakingIn
            });

            expect(response.status()).toBe(400);
            const body = await response.json();
            
            // ОБНОВЛЕНО: Используем актуальный текст ошибки из логов
            const expectedError = "Different social classes cannot share cabins on Titanic. Jack (3rd class) and Rose (1st class) must remain separate... for now. 🎭🚢";
            expect(body.detail).toBe(expectedError);
        });
    });
});
