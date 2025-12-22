import { test, expect } from '@playwright/test';
import { BASE_URL, AUTH_SERVICE_URL } from '../../src/config/constants';

test.describe('🔐 Auth Service Integration Tests', () => {

    // Вспомогательная функция для генерации уникальных данных
    const generateUser = () => {
        const timestamp = Date.now();
        return {
            username: `user_${timestamp}`,
            password: 'password123',
            email: `user_${timestamp}@example.com`
        };
    };

    test.describe('1. Service Info & Health', () => {
        test('GET /api/auth/ - Should return service info', async ({ request }) => {
            // Gateway проксирует /api/auth/ на корневой маршрут Auth Service
            const response = await request.get(`${AUTH_SERVICE_URL}`);
            expect(response.status()).toBe(200);
            
            const body = await response.json();
            // Проверяем поля
            expect(body.service).toBe("Titanic Auth Service");
            expect(body.status).toBe("running");
            expect(body).toHaveProperty("users_count");
        });
    });

    test.describe('2. Registration Logic', () => {
        test('POST /register - Should register new user and return tokens', async ({ request }) => {
            const newUser = generateUser();
            const response = await request.post(`${BASE_URL}/api/auth/register`, {
                data: newUser
            });

            expect(response.status()).toBe(201); // status.HTTP_201_CREATED
            const body = await response.json();

            // Проверяем структуру TokenResponse
            expect(body.access_token).toBeTruthy();
            expect(body.refresh_token).toBeTruthy();
            expect(body.token_type).toBe("bearer");
            // Проверяем expiration (15 мин * 60 = 900 сек)
            expect(body.expires_in).toBe(900); 
        });

        test('POST /register - Should fail for duplicate username', async ({ request }) => {
            const user = generateUser();
            
            // Первая регистрация
            await request.post(`${BASE_URL}/api/auth/register`, { data: user });
            
            // Повторная регистрация того же юзера
            const response = await request.post(`${BASE_URL}/api/auth/register`, { data: user });
            
            expect(response.status()).toBe(400);
            const body = await response.json();
            // Проверяем текст ошибки
            expect(body.detail).toContain(`User with username '${user.username}' already exists`);
        });

        test('POST /register - Should validate password length', async ({ request }) => {
            const shortPassUser = { ...generateUser(), password: "123" };
            const response = await request.post(`${BASE_URL}/api/auth/register`, {
                data: shortPassUser
            });
            // Pydantic валидация вернет 422
            expect(response.status()).toBe(422); 
        });
    });

    test.describe('3. Login Logic', () => {
        test('POST /login - Should login successfully', async ({ request }) => {
            // Сначала регистрируем
            const user = generateUser();
            await request.post(`${BASE_URL}/api/auth/register`, { data: user });

            // Затем логинимся
            const response = await request.post(`${BASE_URL}/api/auth/login`, {
                data: { username: user.username, password: user.password }
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body.access_token).toBeTruthy();
        });

        test('POST /login - Should fail with wrong password', async ({ request }) => {
            const user = generateUser();
            await request.post(`${BASE_URL}/api/auth/register`, { data: user });

            const response = await request.post(`${BASE_URL}/api/auth/login`, {
                data: { username: user.username, password: "WRONG_PASSWORD" }
            });

            expect(response.status()).toBe(401);
            const body = await response.json();
            expect(body.detail).toBe("Incorrect username or password");
        });

        test('POST /login - Should fail for non-existent user', async ({ request }) => {
            const response = await request.post(`${BASE_URL}/api/auth/login`, {
                data: { username: "ghost_user", password: "password123" }
            });
            expect(response.status()).toBe(401);
        });
    });

    test.describe('4. Token Management (Refresh & Logout)', () => {
        let accessToken: string;
        let refreshToken: string;

        test.beforeEach(async ({ request }) => {
            const user = generateUser();
            const regResponse = await request.post(`${BASE_URL}/api/auth/register`, { data: user });
            const body = await regResponse.json();
            accessToken = body.access_token;
            refreshToken = body.refresh_token;
        });

        test('POST /refresh - Should refresh access token', async ({ request }) => {
            // Ждем 1.5 сек, чтобы exp time изменилось
            await new Promise(resolve => setTimeout(resolve, 1500));

            const response = await request.post(`${BASE_URL}/api/auth/refresh`, {
                data: { refresh_token: refreshToken }
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            
            // Новый токен должен отличаться от старого
            expect(body.access_token).not.toBe(accessToken);
            // Refresh token остается тем же
            expect(body.refresh_token).toBe(refreshToken);
        });

        test('POST /logout - Should invalidate refresh token', async ({ request }) => {
            // 1. Делаем logout
            const logoutResponse = await request.post(`${BASE_URL}/api/auth/logout`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                data: { refresh_token: refreshToken }
            });
            expect(logoutResponse.status()).toBe(204);

            // 2. Пытаемся использовать этот refresh token снова (должна быть ошибка)
            const refreshResponse = await request.post(`${BASE_URL}/api/auth/refresh`, {
                data: { refresh_token: refreshToken }
            });
            
            expect(refreshResponse.status()).toBe(401);
            const body = await refreshResponse.json();
            expect(body.detail).toBe("Refresh token has been revoked or is invalid");
        });
    });

    test.describe('5. Profile Management', () => {
        let accessToken: string;
        let userData: any;

        test.beforeEach(async ({ request }) => {
            userData = generateUser();
            const regResponse = await request.post(`${BASE_URL}/api/auth/register`, { data: userData });
            accessToken = (await regResponse.json()).access_token;
        });

        test('GET /me - Should return profile info', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            
            expect(body.username).toBe(userData.username);
            expect(body.email).toBe(userData.email);
            expect(body.is_active).toBe(true);
            expect(body).not.toHaveProperty('password_hash'); // Проверка безопасности
        });

        test('PUT /me - Should update email', async ({ request }) => {
            const newEmail = `updated_${Date.now()}@test.com`;
            
            const response = await request.put(`${BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                data: { email: newEmail }
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body.email).toBe(newEmail);

            // Проверяем, что изменения сохранились
            const checkResponse = await request.get(`${BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            expect((await checkResponse.json()).email).toBe(newEmail);
        });
    });
});