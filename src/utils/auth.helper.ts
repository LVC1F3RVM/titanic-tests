// src/utils/auth.helper.ts
import { APIRequestContext, expect } from '@playwright/test';
import { BASE_URL } from '../config/constants';

export async function getAuthToken(request: APIRequestContext, credentials: any): Promise<string> {
    // Используем полный URL, чтобы избежать ошибок "Invalid URL"
    const regUrl = `${BASE_URL}/api/auth/register`;
    const loginUrl = `${BASE_URL}/api/auth/login`;

    // 1. Пытаемся зарегистрироваться
    const regResponse = await request.post(regUrl, {
        data: credentials
    });

    // Если пользователь уже существует (400), то просто логинимся
    if (regResponse.status() === 400) {
        const loginResponse = await request.post(loginUrl, {
            data: { username: credentials.username, password: credentials.password }
        });
        
        // Проверяем, что логин успешен, иначе тест упадет с понятной ошибкой
        expect(loginResponse.ok(), 'Login failed during auth helper').toBeTruthy();
        
        const loginBody = await loginResponse.json();
        return loginBody.access_token;
    }

    // Если регистрация успешна (200/201)
    expect(regResponse.ok(), 'Registration failed').toBeTruthy();
    const regBody = await regResponse.json();
    return regBody.access_token;
}