import cron from 'node-cron';
import { config } from '../config.js';
import { dbQueries } from '../database/db.js';
import { sendQuestionToUser } from '../handlers/questionHandler.js';
import TelegramBot from 'node-telegram-bot-api';
import { appendFileSync } from 'fs';

let bot = null;

// Инициализация планировщика
export function initScheduler(telegramBot) {
  bot = telegramBot;

  // Создаем задачи для каждого времени из конфигурации
  config.availableTimes.forEach(time => {
    const [hours, minutes] = time.split(':');
    const cronExpression = `${minutes} ${hours} * * *`; // Каждый день в указанное время

    cron.schedule(cronExpression, async () => {
      await sendScheduledQuestions(time);
    }, {
      timezone: config.timezone
    });
  });

  // Задача для отправки напоминаний (каждые 30 минут проверяем неотвеченные вопросы)
  cron.schedule('*/30 * * * *', async () => {
    await sendReminders();
  }, {
    timezone: config.timezone
  });

  console.log('Планировщик инициализирован');
}

// Отправка вопросов по расписанию
async function sendScheduledQuestions(time) {
  try {
    const users = dbQueries.getUsersByTime.all(time);

    for (const user of users) {
      try {
        await sendQuestionToUser(bot, user);
        // Небольшая задержка между отправками
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logError(`Ошибка отправки вопроса пользователю ${user.user_id}: ${error.message}`);
      }
    }
  } catch (error) {
    logError(`Ошибка в sendScheduledQuestions: ${error.message}`);
  }
}

// Отправка напоминаний
async function sendReminders() {
  try {
    const allUsers = dbQueries.getAllActiveUsers.all();

    for (const user of allUsers) {
      try {
        // Получаем неотвеченные вопросы старше 2 часов
        const unansweredQuestions = dbQueries.getUnansweredQuestions(
          user.user_id,
          config.reminderHours
        );

        for (const sentQuestion of unansweredQuestions) {
          // Отправляем напоминание
          await bot.sendMessage(
            user.chat_id,
            '⏰ Напоминание: ты еще не ответил на сегодняшний вопрос! Используй /today, чтобы получить его снова.'
          );

          // Помечаем, что напоминание отправлено
          dbQueries.markReminderSent.run(user.user_id, sentQuestion.question_id);
        }
      } catch (error) {
        // Если пользователь заблокировал бота, помечаем его как неактивного
        if (error.response?.statusCode === 403) {
          dbQueries.updateActive.run(0, user.user_id);
        } else {
          logError(`Ошибка отправки напоминания пользователю ${user.user_id}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logError(`Ошибка в sendReminders: ${error.message}`);
  }
}

// Логирование ошибок
function logError(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    appendFileSync(config.errorsLogPath, logMessage);
  } catch (error) {
    console.error('Ошибка записи в лог:', error);
  }
  
  console.error(message);
}
