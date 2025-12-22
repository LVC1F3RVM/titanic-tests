import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../src/config/constants';

test.describe('📊 Statistics Service Integration Tests', () => {

    test.describe('1. General Statistics', () => {
        
        test('GET /api/stats - Should return aggregate metrics', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/stats`);
            expect(response.status()).toBe(200);
            
            const body = await response.json();
            
            // Проверяем обязательные поля
            expect(body).toHaveProperty('total_passengers');
            expect(body).toHaveProperty('average_age');
            expect(body).toHaveProperty('average_fare');
            expect(body).toHaveProperty('most_expensive_ticket');
            expect(body).toHaveProperty('most_popular_destination');

            // Проверяем типы данных
            expect(typeof body.total_passengers).toBe('number');
            expect(typeof body.average_fare).toBe('number');
            
            // Логическая проверка: средний возраст должен быть разумным (если есть пассажиры)
            if (body.total_passengers > 0) {
                expect(body.average_age).toBeGreaterThan(0);
                expect(body.average_age).toBeLessThan(100);
            }
        });
    });

    test.describe('2. Class Analysis', () => {
        
        test('GET /api/stats/by-class - Should return stats for all 3 classes', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/stats/by-class`);
            expect(response.status()).toBe(200);
            
            const body = await response.json();
            
            // Должны быть ключи для всех трех классов
            const classes = ['class_1', 'class_2', 'class_3'];
            classes.forEach(cls => {
                expect(body).toHaveProperty(cls);
                const classStats = body[cls];
                expect(classStats).toHaveProperty('total');
                expect(classStats).toHaveProperty('average_fare');
                expect(classStats).toHaveProperty('average_age');
            });
        });
    });

    test.describe('3. Port Analysis', () => {
        
        test('GET /api/stats/by-port - Should return stats for known ports', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/stats/by-port`);
            expect(response.status()).toBe(200);
            
            const body = await response.json();
            
            // Проверка жестко заданных портов: Southampton, Cherbourg, Queenstown
            const ports = ['Southampton', 'Cherbourg', 'Queenstown'];
            
            ports.forEach(port => {
                // Если пассажиров из этого порта нет, ключ все равно должен быть (с нулями)
                expect(body).toHaveProperty(port);
                expect(body[port]).toHaveProperty('total');
                expect(body[port]).toHaveProperty('average_fare');
            });
        });
    });

    test.describe('4. Destinations & Easter Eggs', () => {
        
        test('GET /api/stats/destinations - Should list top destinations', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/stats/destinations`);
            expect(response.status()).toBe(200);
            
            const body = await response.json();
            expect(body).toHaveProperty('destinations');
            expect(Array.isArray(body.destinations)).toBeTruthy();
            
            if (body.destinations.length > 0) {
                const dest = body.destinations[0];
                expect(dest).toHaveProperty('name');
                expect(dest).toHaveProperty('count');
            }
        });
    });

    test.describe('5. Age Distribution', () => {
        
        test('GET /api/stats/age-distribution - Should return valid groups', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/api/stats/age-distribution`);
            expect(response.status()).toBe(200);
            
            const body = await response.json();
            
            // Проверяем все возрастные группы
            const groups = [
                'children_0_12', 
                'teens_13_19', 
                'adults_20_40', 
                'middle_age_41_60', 
                'seniors_61_plus'
            ];
            
            let totalPercentage = 0;

            groups.forEach(group => {
                expect(body).toHaveProperty(group);
                expect(body[group]).toHaveProperty('count');
                expect(body[group]).toHaveProperty('percentage');
                totalPercentage += body[group].percentage;
            });

            // Проверка математики: сумма процентов должна быть ~100% (или 0, если база пустая)
            // Допускаем небольшую погрешность округления
            if (totalPercentage > 0) {
                expect(totalPercentage).toBeGreaterThanOrEqual(99.0);
                expect(totalPercentage).toBeLessThanOrEqual(101.0);
            }
        });
    });
});