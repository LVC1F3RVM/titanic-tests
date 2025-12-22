import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../src/config/constants';

// Этот тест не для CI/CD, а для ручной проверки отказоустойчивости.
// Запустите его и выполните: docker stop passenger-service
// Наблюдайте, как меняются ответы.

test.skip('🔥 Resilience: Stats Service survival check (Manual Run)', async ({ request }) => {
    // Увеличиваем таймаут теста до 2 минут
    test.setTimeout(120000); 

    console.log('Starting resilience loop... Stop "passenger-service" now!');

    for (let i = 0; i < 20; i++) {
        const start = Date.now();
        const response = await request.get(`${BASE_URL}/api/stats`);
        const duration = Date.now() - start;

        console.log(`Req #${i + 1}: Status ${response.status()} (${duration}ms)`);

        if (response.status() === 200) {
            console.log('✅ Service Healthy');
        } else if (response.status() === 503 || response.status() === 502) {
            console.log('⚠️ Service Degraded (Handled Gracefully)');
            // Это хороший результат при отключенном passenger-service
        } else if (response.status() === 500) {
            console.log('❌ CRITICAL: Internal Server Error (Unhandled Exception)');
            // Это плохой результат
        }

        // Ждем 2 секунды перед следующим запросом
        await new Promise(r => setTimeout(r, 2000));
    }
});