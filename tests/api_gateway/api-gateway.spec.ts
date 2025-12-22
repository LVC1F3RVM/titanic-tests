import { test, expect } from '@playwright/test';
import { BASE_URL, NEW_PASSENGER } from '../../src/config/constants';
import { getAuthToken } from '../../src/utils/auth.helper';

test.describe('🚢 Titanic API Gateway Integration Tests', () => {

    // Глобальная переменная для токена админа
    let globalAdminToken: string;

    // ВАЖНО: Регистрируем Admin пользователя самым первым шагом!
    // В системе Titanic первый зарегистрированный пользователь становится ADMIN.
    // Если мы позволим другим тестам запуститься раньше, они займут роль Admin, 
    // и наш пользователь 'admin' станет обычным 'user', у которого нет прав на DELETE.
    test.beforeAll(async ({ request }) => {
        const systemAdmin = {
            username: 'admin',
            password: 'admin123',
            email: 'admin@titanic.com'
        };
        // Этот вызов гарантирует, что admin будет первым (или залогинится, если уже есть)
        globalAdminToken = await getAuthToken(request, systemAdmin);
        console.log('Admin token obtained successfully.');
    });

    // === Tag: Gateway ===
    test.describe('1. Gateway Infrastructure', () => {
        
        test('GET / - Should return API info and status', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/`);
            expect(response.status()).toBe(200);
            const body = await response.json();
            
            expect(body.service).toBe("Titanic API Gateway");
            expect(body.status).toBe("running");
        });

        test('GET /health - Should check all microservices status', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/health`);
            expect(response.status()).toBe(200);
            const body = await response.json();

            expect(body.gateway).toBe("healthy");
            expect(body.services.auth_service.status).toBe("healthy");
            expect(body.services.passenger_service.status).toBe("healthy");
            expect(body.services.stats_service.status).toBe("healthy");
        });
    });

    // === Tag: Authentication ===
    test.describe('2. Authentication Service Proxy', () => {
        
        test('Full Auth Cycle: Register -> Login -> Me -> Refresh -> Logout', async ({ request }) => {
            const uniqueUser = {
                username: `gw_test_${Date.now()}`,
                password: 'password123',
                email: `gw_${Date.now()}@test.com`
            };

            // 1. Register
            const regResponse = await request.post(`${BASE_URL}/api/auth/register`, { data: uniqueUser });
            expect(regResponse.status()).toBe(201);
            const tokens = await regResponse.json();
            
            // 2. Me
            const meResponse = await request.get(`${BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });
            expect(meResponse.status()).toBe(200);
            expect((await meResponse.json()).username).toBe(uniqueUser.username);

            // 3. Refresh (с паузой для смены exp time)
            await new Promise(resolve => setTimeout(resolve, 1500));
            const refreshResponse = await request.post(`${BASE_URL}/api/auth/refresh`, {
                data: { refresh_token: tokens.refresh_token }
            });
            expect(refreshResponse.status()).toBe(200);
            const newTokens = await refreshResponse.json();
            expect(newTokens.access_token).not.toBe(tokens.access_token);

            // 4. Logout
            const logoutResponse = await request.post(`${BASE_URL}/api/auth/logout`, {
                headers: { 'Authorization': `Bearer ${newTokens.access_token}` },
                data: { refresh_token: tokens.refresh_token }
            });
            expect([200, 204]).toContain(logoutResponse.status());
        });
    });

    // === Tag: Passengers ===
    test.describe('3. Passenger Service Proxy', () => {
        
        test('GET /api/passengers - Should list passengers', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/passengers`, {
                params: { limit: 5 }
            });
            expect(response.status()).toBe(200);
            const list = await response.json();
            expect(Array.isArray(list)).toBeTruthy();
        });

        // ОБЪЕДИНЕННЫЙ ТЕСТ (CRUD Flow)
        test('Full Passenger Lifecycle: Create -> Search -> Update -> Delete', async ({ request }) => {
            // Используем globalAdminToken, который точно имеет права ADMIN
            
            // 1. Create (POST)
            const createResp = await request.post(`${BASE_URL}/api/passengers`, {
                headers: { 'Authorization': `Bearer ${globalAdminToken}` },
                data: NEW_PASSENGER
            });
            expect(createResp.status()).toBe(201);
            const createdBody = await createResp.json();
            const createdId = createdBody.id;
            expect(createdId).toBeTruthy();

            // 2. Search (GET)
            const searchName = NEW_PASSENGER.name.split(',')[0]; 
            const searchResp = await request.get(`${BASE_URL}/api/passengers/search`, {
                params: { name: searchName }
            });
            expect(searchResp.status()).toBe(200);
            const searchResults = await searchResp.json();
            const found = searchResults.find((p: any) => p.id === createdId);
            expect(found, 'Created passenger should be found by search').toBeTruthy();

            // 3. Update (PUT)
            const updateResp = await request.put(`${BASE_URL}/api/passengers/${createdId}`, {
                headers: { 'Authorization': `Bearer ${globalAdminToken}` },
                data: { ...NEW_PASSENGER, fare: 999.99 }
            });
            expect(updateResp.status()).toBe(200);
            const updatedBody = await updateResp.json();
            expect(updatedBody.fare).toBe(999.99);

            // 4. Delete (DELETE) - Только Admin может это сделать
            const deleteResp = await request.delete(`${BASE_URL}/api/passengers/${createdId}`, {
                headers: { 'Authorization': `Bearer ${globalAdminToken}` }
            });
            expect([200, 204]).toContain(deleteResp.status());

            // 5. Verify Deletion
            const verifyResp = await request.get(`${BASE_URL}/api/passengers/${createdId}`);
            expect(verifyResp.status()).toBe(404);
        });
    });

    // === Tag: Statistics ===
    test.describe('4. Statistics Service Proxy', () => {
        test('GET /api/stats endpoints', async ({ request }) => {
            // General Stats
            const stats = await request.get(`${BASE_URL}/api/stats`);
            expect(stats.status()).toBe(200);
            expect(await stats.json()).toHaveProperty('total_passengers');

            // Destinations
            const dests = await request.get(`${BASE_URL}/api/stats/destinations`);
            expect(dests.status()).toBe(200);
            const destBody = await dests.json();
            expect(typeof destBody).toBe('object'); 
            
            // Port Stats
            const ports = await request.get(`${BASE_URL}/api/stats/by-port`);
            expect(ports.status()).toBe(200);
            expect(await ports.json()).toHaveProperty('Southampton');
        });
    });
});