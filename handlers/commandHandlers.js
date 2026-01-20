import { config } from '../config.js';
import { dbQueries } from '../database/db.js';
import { getQuestionForUser, sendQuestionToUser } from './questionHandler.js';
import { getMainKeyboard } from '../utils/keyboard.js';

export async function handleStart(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || 'Пользователь';

  try {
    let user = dbQueries.getUser.get(userId);

    if (!user) {
      // Регистрация нового пользователя
      dbQueries.createUser.run(
        userId,
        chatId,
        username,
        config.defaultSubject,
        config.defaultTime
      );
      user = dbQueries.getUser.get(userId);
    } else {
      // Обновление информации о пользователе
      dbQueries.updateUser.run(
        username,
        user.subject,
        user.notification_time,
        1,
        userId
      );
    }

    const subjectName = config.subjects[user.subject] || 'Математика';

    const welcomeText = `👋 Привет, ${username}!

Я бот "ВопросДня от Повторюши" - твой помощник в подготовке к ЕГЭ!

📚 Твой текущий предмет: ${subjectName}
⏰ Время уведомлений: ${user.notification_time}

Я буду присылать тебе по одному вопросу для ЕГЭ каждый день в выбранное время.

Используй кнопки ниже или команды:
/subject - выбрать предмет
/time - изменить время уведомлений
/today - получить вопрос прямо сейчас
/progress - посмотреть статистику
/help - список всех команд

Готов начать подготовку? 🚀`;

    await bot.sendMessage(chatId, welcomeText, {
      reply_markup: getMainKeyboard()
    });
  } catch (error) {
    console.error('Ошибка в handleStart:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка при регистрации. Попробуйте позже.');
  }
}

export async function handleHelp(bot, msg) {
  const chatId = msg.chat.id;

  const helpText = `📖 Список команд:

/start - Регистрация и приветствие
/help - Показать эту справку
/subject - Выбрать предмет для подготовки
/time - Изменить время уведомлений
/today - Получить вопрос прямо сейчас
/progress - Статистика ответов
/stop - Приостановить уведомления
/resume - Возобновить уведомления

💡 Совет: Используй кнопки внизу для быстрого доступа к функциям!`;

  await bot.sendMessage(chatId, helpText, {
    reply_markup: getMainKeyboard()
  });
}

export async function handleTime(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const keyboard = {
    inline_keyboard: config.availableTimes.map(time => [
      {
        text: `🕐 ${time}`,
        callback_data: `set_time_${time}`
      }
    ])
  };

  await bot.sendMessage(
    chatId,
    '⏰ Выбери время для ежедневных уведомлений:',
    { reply_markup: keyboard }
  );
}

export async function handleSubject(bot, msg) {
  const chatId = msg.chat.id;

  const keyboard = {
    inline_keyboard: Object.entries(config.subjects).map(([key, name]) => [
      {
        text: `📚 ${name}`,
        callback_data: `set_subject_${key}`
      }
    ])
  };

  await bot.sendMessage(
    chatId,
    '📚 Выбери предмет для подготовки:',
    { reply_markup: keyboard }
  );
}

export async function handleToday(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    const user = dbQueries.getUser.get(userId);
    if (!user) {
      await bot.sendMessage(chatId, 'Сначала используй команду /start для регистрации.', {
        reply_markup: getMainKeyboard()
      });
      return;
    }

    await bot.sendMessage(chatId, '📝 Загружаю вопрос для тебя...');
    await sendQuestionToUser(bot, user);
  } catch (error) {
    console.error('Ошибка в handleToday:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка при получении вопроса. Попробуйте позже.', {
      reply_markup: getMainKeyboard()
    });
  }
}

export async function handleStop(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    dbQueries.updateActive.run(0, userId);
    await bot.sendMessage(
      chatId,
      '⏸ Уведомления приостановлены. Используй кнопку "▶️ Возобновить" или команду /resume, чтобы возобновить.',
      {
        reply_markup: getMainKeyboard()
      }
    );
  } catch (error) {
    console.error('Ошибка в handleStop:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.', {
      reply_markup: getMainKeyboard()
    });
  }
}

export async function handleResume(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    dbQueries.updateActive.run(1, userId);
    const user = dbQueries.getUser.get(userId);
    await bot.sendMessage(
      chatId,
      `✅ Уведомления возобновлены!\n⏰ Время уведомлений: ${user.notification_time}`,
      {
        reply_markup: getMainKeyboard()
      }
    );
  } catch (error) {
    console.error('Ошибка в handleResume:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.', {
      reply_markup: getMainKeyboard()
    });
  }
}

export async function handleProgress(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    const user = dbQueries.getUser.get(userId);
    if (!user) {
      await bot.sendMessage(chatId, 'Сначала используй команду /start для регистрации.', {
        reply_markup: getMainKeyboard()
      });
      return;
    }

    const stats = dbQueries.getUserStats.get(userId);
    const total = stats.total_questions || 0;
    const correct = stats.correct_answers || 0;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const progressText = `📊 Твоя статистика:

📝 Всего вопросов: ${total}
✅ Правильных ответов: ${correct}
❌ Неправильных: ${total - correct}
📈 Процент правильных: ${percentage}%

Продолжай в том же духе! 💪`;

    await bot.sendMessage(chatId, progressText, {
      reply_markup: getMainKeyboard()
    });
  } catch (error) {
    console.error('Ошибка в handleProgress:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка при получении статистики.', {
      reply_markup: getMainKeyboard()
    });
  }
}

// Обработка callback-запросов
export async function handleCallbackQuery(bot, query) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data.startsWith('set_time_')) {
      const time = data.replace('set_time_', '');
      if (config.availableTimes.includes(time)) {
        dbQueries.updateTime.run(time, userId);
        await bot.answerCallbackQuery(query.id, { text: `Время установлено: ${time}` });
        await bot.editMessageText(
          `✅ Время уведомлений установлено: ${time}`,
          { chat_id: chatId, message_id: query.message.message_id }
        );
        // Показываем клавиатуру после изменения времени
        await bot.sendMessage(chatId, 'Настройки сохранены!', {
          reply_markup: getMainKeyboard()
        });
      }
    } else if (data.startsWith('set_subject_')) {
      const subject = data.replace('set_subject_', '');
      if (config.subjects[subject]) {
        dbQueries.updateSubject.run(subject, userId);
        const subjectName = config.subjects[subject];
        await bot.answerCallbackQuery(query.id, { text: `Предмет выбран: ${subjectName}` });
        await bot.editMessageText(
          `✅ Предмет выбран: ${subjectName}`,
          { chat_id: chatId, message_id: query.message.message_id }
        );
        // Показываем клавиатуру после выбора предмета
        await bot.sendMessage(chatId, 'Предмет изменен!', {
          reply_markup: getMainKeyboard()
        });
      }
    }
  } catch (error) {
    console.error('Ошибка в handleCallbackQuery:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
  }
}
