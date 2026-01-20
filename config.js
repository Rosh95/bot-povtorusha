import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  timezone: process.env.TIMEZONE || 'Europe/Moscow',
  reminderHours: 2, // Через сколько часов отправлять напоминание
  databasePath: join(__dirname, 'database', 'bot.db'),
  errorsLogPath: join(__dirname, 'errors.log'),
  questionsPath: join(__dirname, 'questions'),
  defaultSubject: 'math',
  defaultTime: '09:00',
  subjects: {
    math: 'Математика',
    russian: 'Русский язык',
    physics: 'Физика',
    social: 'Обществознание',
    history: 'История'
  },
  availableTimes: ['08:00', '09:00', '10:00', '18:00', '20:00']
};
