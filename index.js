import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import {
  handleStart,
  handleHelp,
  handleTime,
  handleSubject,
  handleToday,
  handleStop,
  handleResume,
  handleProgress,
  handleCallbackQuery
} from './handlers/commandHandlers.js';
import { getMainKeyboard } from './utils/keyboard.js';
import {
  handleAnswer,
  showAnswer,
  handleNextQuestion
} from './handlers/questionHandler.js';
import { initScheduler } from './utils/scheduler.js';

// Проверка токена
if (!config.botToken) {
  console.error('Ошибка: BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

// Создание бота
const bot = new TelegramBot(config.botToken, { polling: true });

console.log('Бот запущен и готов к работе! 🤖');

// Обработка команд
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
bot.onText(/\/time/, (msg) => handleTime(bot, msg));
bot.onText(/\/subject/, (msg) => handleSubject(bot, msg));
bot.onText(/\/today/, (msg) => handleToday(bot, msg));
bot.onText(/\/stop/, (msg) => handleStop(bot, msg));
bot.onText(/\/resume/, (msg) => handleResume(bot, msg));
bot.onText(/\/progress/, (msg) => handleProgress(bot, msg));

// Обработка текстовых сообщений (кнопки)
bot.on('message', async (msg) => {
  // Пропускаем команды (они обрабатываются отдельно через onText)
  if (!msg.text || msg.text.startsWith('/')) {
    return;
  }

  const text = msg.text;
  const chatId = msg.chat.id;

  // Обработка нажатий на кнопки
  try {
    if (text === '📝 Вопрос сейчас') {
      await handleToday(bot, msg);
    } else if (text === '📊 Статистика') {
      await handleProgress(bot, msg);
    } else if (text === '📚 Выбрать предмет') {
      await handleSubject(bot, msg);
    } else if (text === '⏰ Изменить время') {
      await handleTime(bot, msg);
    } else if (text === '⏸ Приостановить') {
      await handleStop(bot, msg);
    } else if (text === '▶️ Возобновить') {
      await handleResume(bot, msg);
    } else if (text === 'ℹ️ Помощь') {
      await handleHelp(bot, msg);
    } else if (text === '⚙️ Настройки') {
      // Показываем меню настроек
      const settingsKeyboard = {
        inline_keyboard: [
          [
            { text: '📚 Выбрать предмет', callback_data: 'menu_subject' },
            { text: '⏰ Изменить время', callback_data: 'menu_time' }
          ],
          [
            { text: '📊 Статистика', callback_data: 'menu_progress' }
          ],
          [
            { text: '◀️ Назад', callback_data: 'menu_back' }
          ]
        ]
      };
      await bot.sendMessage(chatId, '⚙️ Настройки:', {
        reply_markup: settingsKeyboard
      });
    }
    // Если текст не соответствует ни одной кнопке, игнорируем
  } catch (error) {
    console.error('Ошибка обработки текстового сообщения:', error);
  }
});

// Обработка callback-запросов
bot.on('callback_query', async (query) => {
  const data = query.data;

  try {
    if (data.startsWith('set_time_') || data.startsWith('set_subject_')) {
      await handleCallbackQuery(bot, query);
    } else if (data === 'menu_subject') {
      await handleSubject(bot, { chat: { id: query.message.chat.id } });
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'menu_time') {
      await handleTime(bot, { chat: { id: query.message.chat.id } });
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'menu_progress') {
      await handleProgress(bot, { from: { id: query.from.id }, chat: { id: query.message.chat.id } });
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'menu_back') {
      await bot.editMessageText('Главное меню', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: getMainKeyboard()
      });
      await bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('answer_')) {
      // Формат: answer_questionId_answerIndex
      const match = data.match(/^answer_(.+?)_(\d+)$/);
      if (match) {
        const questionId = match[1];
        const answerIndex = parseInt(match[2]);
        await handleAnswer(bot, query, questionId, answerIndex);
      }
    } else if (data.startsWith('show_answer_')) {
      const questionId = data.replace('show_answer_', '');
      await showAnswer(bot, query, questionId);
    } else if (data === 'next_question') {
      await handleNextQuestion(bot, query);
    }
  } catch (error) {
    console.error('Ошибка обработки callback:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Ошибка polling:', error);
});

// Инициализация планировщика
initScheduler(bot);

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('\nЗавершение работы бота...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nЗавершение работы бота...');
  bot.stopPolling();
  process.exit(0);
});
