import { Kafka, Producer, Consumer, Admin, logLevel } from 'kafkajs';

export class KafkaHelper {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'titanic-test-client',
      brokers: ['localhost:9092'],
      logLevel: logLevel.ERROR, // Оставляем ERROR, чтобы видеть критические проблемы
      retry: {
        initialRetryTime: 300,
        retries: 10 // Увеличиваем количество попыток подключения
      }
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'test-group-' + Date.now() });
    this.admin = this.kafka.admin();
  }

  async connect() {
    await this.producer.connect();
    await this.consumer.connect();
    await this.admin.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
    await this.admin.disconnect();
  }

  // Явное создание топика гарантирует, что он готов к работе
  async ensureTopicExists(topic: string) {
    const topics = await this.admin.listTopics();
    if (!topics.includes(topic)) {
      console.log(`[Kafka] Creating topic '${topic}'...`);
      await this.admin.createTopics({
        topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
        waitForLeaders: true, // Ждем выбора лидера раздела
      });
      console.log(`[Kafka] Topic '${topic}' created and ready.`);
    }
  }

  async sendMessage(topic: string, message: object) {
    await this.producer.send({
      topic,
      messages: [
        { value: JSON.stringify(message) },
      ],
    });
    console.log(`[Kafka] Sent to ${topic}:`, message);
  }

  async consumeOneMessage(topic: string, timeoutMs: number = 10000): Promise<any> {
    await this.consumer.subscribe({ topic, fromBeginning: true });
    
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(async () => {
        // При таймауте отключаем консьюмер, чтобы тест не завис
        try {
            await this.consumer.stop();
        } catch (e) {}
        reject(new Error(`Kafka timeout: No message received in ${topic} after ${timeoutMs}ms`));
      }, timeoutMs);

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (message.value) {
            clearTimeout(timeout);
            const content = JSON.parse(message.value.toString());
            console.log(`[Kafka] Received from ${topic}:`, content);
            resolve(content);
            // Останавливаем обработку после первого сообщения
            // Внимание: stop() может вызвать ошибку, если раннер уже останавливается, это нормально в тесте
            try {
               await this.consumer.stop(); 
            } catch (e) {} 
          }
        },
      });
    });
  }
}