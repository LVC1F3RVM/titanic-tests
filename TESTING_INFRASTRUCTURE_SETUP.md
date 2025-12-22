# **🛠️ Настройка инфраструктуры тестирования (Playwright/TypeScript)**

В этом руководстве описан пошаговый процесс настройки проекта titanic-tests с нуля, включая конфигурацию TypeScript и создание базового теста авторизации.

## **Шаг 1: Инициализация проекта Node.js**

Создайте новую директорию для тестов и инициализируйте пустой Node.js проект.

\# Создайте новую папку для тестов  
mkdir titanic-tests  
cd titanic-tests

\# Инициализируйте Node.js проект (создает package.json)  
npm init \-y

## **Шаг 2: Установка Playwright Test**

Установите Playwright и необходимые типы для TypeScript.

\# Установите Playwright и зависимости  
npm install \-D @playwright/test typescript @types/node

\# Инициализируйте Playwright (выберите TypeScript при установке)  
npx playwright init

*При инициализации выберите **TypeScript** как язык проекта.*

## **Шаг 3: Настройка TypeScript (tsconfig.json)**

Убедитесь, что в корне проекта есть файл tsconfig.json со следующими настройками. Если файла нет, создайте его вручную.

**Файл:** tsconfig.json

{  
  "compilerOptions": {  
    "target": "ES2020",  
    "module": "CommonJS",  
    "rootDir": "./",  
    "moduleResolution": "node",  
    "outDir": "./dist",  
    "esModuleInterop": true,  
    "forceConsistentCasingInFileNames": true,  
    "strict": true,  
    "skipLibCheck": true,  
    "sourceMap": true,  
    "allowJs": true,  
    "resolveJsonModule": true  
  },  
  "include": \["\*\*/\*.ts", "\*\*/\*.js"\]  
}

## **Шаг 4: Создание констант**

Для удобства поддержки вынесем базовый URL и тестовые данные в отдельный файл.

**Файл:** src/config/constants.ts

// src/config/constants.ts

/\*\* Базовый URL API Gateway \*/  
export const BASE\_URL \= 'http://localhost:8000';

/\*\* Дефолтные учетные данные для регистрации Admin (первый пользователь) \*/  
export const ADMIN\_CREDENTIALS \= {  
  username: 'captain',  
  password: 'ship123',  
  email: 'captain@titanic.com',  
};

/\*\* Учетные данные для регистрации User (второй пользователь) \*/  
export const USER\_CREDENTIALS \= {  
  username: 'sailor',  
  password: 'pass123',  
  email: 'sailor@titanic.com',  
};

/\*\* Тестовые данные для создания пассажира \*/  
export const NEW\_PASSENGER\_DATA \= {  
  name: "Smith, Mr. John",  
  pclass: 2,  
  sex: "male",  
  age: 30,  
  fare: 25.50,  
  embarked: "Southampton",  
  destination: "New York",  
  cabin: "D45",  
  ticket: "PC 12345"  
};

## **Шаг 5: Создание первого теста (Auth & Roles)**

Создадим тест, который проверяет ролевую модель: первый пользователь становится Админом, второй — обычным Юзером. Также проверим права на удаление.

**Файл:** tests/auth.spec.ts

// tests/auth.spec.ts  
import { test, expect, APIRequestContext } from '@playwright/test';  
import { BASE\_URL, ADMIN\_CREDENTIALS, USER\_CREDENTIALS, NEW\_PASSENGER\_DATA } from '../src/config/constants';

let apiContext: APIRequestContext;  
let adminToken: string;  
let userToken: string;  
let passengerId: number;

test.beforeAll(async ({ playwright }) \=\> {  
  apiContext \= await playwright.request.newContext({  
    baseURL: BASE\_URL,  
    extraHTTPHeaders: {  
      'Content-Type': 'application/json',  
    },  
  });  
});

test.describe('Auth and Roles Testing (Scenario 3)', () \=\> {

  // 1\. Регистрация Admin  
  test('should register the first user as Admin', async () \=\> {  
    const response \= await apiContext.post('/api/auth/register', {  
      data: ADMIN\_CREDENTIALS,  
    });  
    expect(response.status()).toBe(200);  
    const body \= await response.json();  
    adminToken \= body.access\_token;  
    expect(adminToken).toBeTruthy();  
  });

  // 2\. Регистрация User  
  test('should register the second user as regular User', async () \=\> {  
    const response \= await apiContext.post('/api/auth/register', {  
      data: USER\_CREDENTIALS,  
    });  
    expect(response.status()).toBe(200);  
    const body \= await response.json();  
    userToken \= body.access\_token;  
    expect(userToken).toBeTruthy();  
  });

  // 3\. Создание пассажира (админом)  
  test('Admin should create a new passenger', async () \=\> {  
    const response \= await apiContext.post('/api/passengers', {  
        data: NEW\_PASSENGER\_DATA,  
        headers: {  
            'Authorization': \`Bearer ${adminToken}\`,  
        }  
    });  
    expect(response.status()).toBe(201);  
    const body \= await response.json();  
    passengerId \= body.id;  
    expect(passengerId).toBeTruthy();  
  });

  // 4\. Попытка удаления пассажира пользователем (User) \- Ожидается отказ  
  test('User should FAIL to delete passenger (403 Forbidden)', async () \=\> {  
    // FR-AS-008.2: DELETE требует роль admin  
    const response \= await apiContext.delete(\`/api/passengers/${passengerId}\`, {  
        headers: {  
            'Authorization': \`Bearer ${userToken}\`,  
        }  
    });  
    expect(response.status()).toBe(403);  
    const body \= await response.json();  
    expect(body.detail).toContain('Admin access required');  
  });

  // 5\. Удаление пассажира админом (Admin) \- Ожидается успех  
  test('Admin should successfully delete the passenger (204 No Content)', async () \=\> {  
    // FR-AS-008.1: Admin имеет полный доступ  
    const response \= await apiContext.delete(\`/api/passengers/${passengerId}\`, {  
        headers: {  
            'Authorization': \`Bearer ${adminToken}\`,  
        }  
    });  
    // Сервис может вернуть 200 или 204  
    expect(\[200, 204\]).toContain(response.status());  
  });

});

test.afterAll(async () \=\> {  
    await apiContext.dispose();  
});

## **Шаг 6: Запуск тестов**

1. Убедитесь, что микросервисы запущены:  
   docker-compose up \--build

2. Запустите тесты Playwright:  
   npx playwright test  
