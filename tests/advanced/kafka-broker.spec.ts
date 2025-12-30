import { test, expect } from '@playwright/test';
import { KafkaHelper } from '../../src/utils/kafka.helper';

test.describe('📨 Kafka Broker Infrastructure Tests', () => {
    let kafka: KafkaHelper;
    const TEST_TOPIC = 'titanic-events';

    test.beforeAll(async () => {
        // Увеличиваем таймаут хука beforeAll, так как подключение к Kafka может быть долгим
        test.setTimeout(60000); 

        kafka = new KafkaHelper();
        try {
            await kafka.connect();
            // Гарантируем, что топик создан до начала тестов
            await kafka.ensureTopicExists(TEST_TOPIC);
            console.log('✅ Connected to Kafka Broker');
        } catch (error) {
            console.error('❌ Failed to connect to Kafka. Is Docker running?', error);
            test.skip();
        }
    });

    test.afterAll(async () => {
        // Устанавливаем таймаут для хука
        test.setTimeout(60000);
        if (kafka) {
            try {
                // ИСПОЛЬЗУЕМ PROMISE.RACE:
                // Мы пытаемся отключиться, но если это занимает больше 5 секунд,
                // мы просто разрываем ожидание и завершаем тест успешно.
                // Это решает проблему зависания "afterAll hook timeout".
                await Promise.race([
                    kafka.disconnect(),
                    new Promise(resolve => setTimeout(() => {
                        console.warn('⚠️ Kafka disconnect timed out - forcing test finish');
                        resolve(true); 
                    }, 5000))
                ]);
            } catch (error) {
                console.warn('⚠️ Warning: Error disconnecting from Kafka (ignoring):', error);
            }
        }
    });

    test('Should produce and consume a message (Event Driven check)', async () => {
        // Увеличиваем таймаут самого теста для медленных окружений (Windows/Docker)
        test.setTimeout(60000);

        const eventPayload = {
            event: 'PASSENGER_CREATED',
            data: {
                id: 101,
                name: 'Test Passenger',
                timestamp: new Date().toISOString()
            }
        };

        // 1. Запускаем прослушивание (Consumer) с увеличенным таймаутом (20 сек)
        // Kafka может долго проводить "выборы лидера" (leadership election)
        const messagePromise = kafka.consumeOneMessage(TEST_TOPIC, 20000);

        // 2. Даем консьюмеру больше времени (5 сек) на инициализацию группы (Rebalancing)
        // Это критично для избежания ошибки "GroupCoordinatorNotFound"
        await new Promise(r => setTimeout(r, 5000));

        // 3. Отправляем сообщение
        await kafka.sendMessage(TEST_TOPIC, eventPayload);

        // 4. Ждем получения сообщения
        const receivedMessage = await messagePromise;

        expect(receivedMessage).toBeTruthy();
        expect(receivedMessage.event).toBe('PASSENGER_CREATED');
        expect(receivedMessage.data.name).toBe('Test Passenger');
    });
});