export const BASE_URL = 'http://localhost:8000';
export const PASSENGER_SERVICE_URL = 'http://localhost:8001';
export const STATS_SERVICE_URL = 'http://localhost:8002';
export const AUTH_SERVICE_URL = 'http://localhost:8003';

// Учетные данные
export const ADMIN_CREDENTIALS = {
  username: `admin_${Date.now()}`, // Уникальное имя, чтобы тесты не падали при перезапуске
  password: 'ship123',
  email: `admin_${Date.now()}@titanic.com`,
};

export const USER_CREDENTIALS = {
  username: `user_${Date.now()}`,
  password: 'pass123',
  email: `user_${Date.now()}@titanic.com`,
};

// Тестовые данные для CRUD
export const NEW_PASSENGER = {
  name: "Smith, Mr. Test",
  pclass: 2,
  sex: "male",
  age: 30,
  fare: 25.50,
  embarked: "Southampton",
  destination: "New York",
  ticket: "TEST-123"
};

// Пасхалка: Данные Розы (1 класс)
export const ROSE_DATA = {
    name: "Bukater, Miss. Rose DeWitt",
    pclass: 1,
    sex: "female",
    age: 17,
    fare: 150.0,
    embarked: "Southampton",
    destination: "New York",
    cabin: "B52", // Каюта Розы
    ticket: "PC 17599"
};

// Пасхалка: Данные Джека (3 класс)
export const JACK_DATA = {
    name: "Dawson, Mr. Jack",
    pclass: 3,
    sex: "male",
    age: 20,
    fare: 0.0,
    embarked: "Southampton",
    destination: "New York",
    ticket: "A/5 21171"
};