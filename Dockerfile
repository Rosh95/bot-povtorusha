FROM node:18-alpine

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем остальные файлы
COPY . .

# Создаем директории для БД и логов
RUN mkdir -p database questions

# Запуск
CMD ["node", "index.js"]
