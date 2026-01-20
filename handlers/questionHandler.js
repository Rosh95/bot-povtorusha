import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config.js';
import { dbQueries } from '../database/db.js';

// Кэш вопросов
const questionsCache = {};

// Загрузка вопросов из файла
function loadQuestions(subject) {
  if (questionsCache[subject]) {
    return questionsCache[subject];
  }

  try {
    const filePath = join(config.questionsPath, `${subject}.json`);
    const fileContent = readFileSync(filePath, 'utf-8');
    const questions = JSON.parse(fileContent);
    questionsCache[subject] = questions;
    return questions;
  } catch (error) {
    console.error(`Ошибка загрузки вопросов для предмета ${subject}:`, error);
    return [];
  }
}

// Получение случайного вопроса для пользователя
export function getQuestionForUser(userId, subject) {
  const questions = loadQuestions(subject);
  
  if (questions.length === 0) {
    return null;
  }

  // Получаем все отправленные вопросы пользователя за последние 30 дней
  const recentQuestions = dbQueries.getUserStats.all(userId)
    .filter(stat => stat.subject === subject)
    .map(stat => stat.question_id);

  // Фильтруем вопросы, которые еще не были отправлены
  const availableQuestions = questions.filter(
    q => !recentQuestions.includes(q.id)
  );

  // Если все вопросы были отправлены, используем все вопросы
  const questionsToChoose = availableQuestions.length > 0 
    ? availableQuestions 
    : questions;

  // Выбираем случайный вопрос
  const randomIndex = Math.floor(Math.random() * questionsToChoose.length);
  return questionsToChoose[randomIndex];
}

// Форматирование вопроса для отправки
function formatQuestion(question) {
  let text = `📚 <b>${question.topic || 'Вопрос'}</b>\n\n`;
  text += `${question.question}\n\n`;

  if (question.type === 'test' && question.options) {
    text += 'Варианты ответов:\n';
    question.options.forEach((option, index) => {
      text += `${index + 1}. ${option}\n`;
    });
  }

  return text;
}

// Создание клавиатуры для вопроса
function createQuestionKeyboard(question) {
  const keyboard = {
    inline_keyboard: []
  };

  if (question.type === 'test' && question.options) {
    // Кнопки с вариантами ответов
    const optionButtons = question.options.map((_, index) => ({
      text: `${index + 1}`,
      callback_data: `answer_${question.id}_${index}`
    }));
    
    // Разбиваем на ряды по 2 кнопки
    for (let i = 0; i < optionButtons.length; i += 2) {
      keyboard.inline_keyboard.push(optionButtons.slice(i, i + 2));
    }
  }

  // Кнопка "Показать ответ"
  keyboard.inline_keyboard.push([
    {
      text: '💡 Показать ответ',
      callback_data: `show_answer_${question.id}`
    }
  ]);

  return keyboard;
}

// Отправка вопроса пользователю
export async function sendQuestionToUser(bot, user) {
  try {
    const question = getQuestionForUser(user.user_id, user.subject);

    if (!question) {
      await bot.sendMessage(
        user.chat_id,
        '❌ К сожалению, вопросы для этого предмета временно недоступны. Попробуйте позже или выберите другой предмет.'
      );
      return;
    }

    const questionText = formatQuestion(question);
    const keyboard = createQuestionKeyboard(question);

    await bot.sendMessage(user.chat_id, questionText, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

    // Сохраняем информацию об отправленном вопросе
    dbQueries.addSentQuestion.run(user.user_id, question.id, user.subject);
  } catch (error) {
    console.error('Ошибка при отправке вопроса:', error);
    throw error;
  }
}

// Обработка ответа пользователя
export async function handleAnswer(bot, query, questionId, answerIndex) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;

  try {
    const user = dbQueries.getUser.get(userId);
    if (!user) return;

    const questions = loadQuestions(user.subject);
    const question = questions.find(q => q.id === questionId);

    if (!question) {
      await bot.answerCallbackQuery(query.id, { text: 'Вопрос не найден' });
      return;
    }

    let isCorrect = false;
    let feedback = '';

    if (question.type === 'test') {
      const correctAnswer = question.correctAnswer;
      isCorrect = correctAnswer === answerIndex;

      if (isCorrect) {
        feedback = '✅ Правильно! Отличная работа!';
      } else {
        feedback = `❌ Неправильно. Правильный ответ: ${question.options[correctAnswer]}`;
      }
    } else {
      // Для открытых вопросов просто показываем ответ
      feedback = '💡 Ответ получен!';
    }

    // Сохраняем статистику
    dbQueries.addStat.run(userId, questionId, user.subject, isCorrect ? 1 : 0);
    dbQueries.markQuestionAnswered.run(userId, questionId);

    await bot.answerCallbackQuery(query.id, { text: feedback });

    // Обновляем сообщение с кнопкой "Следующий вопрос"
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '➡️ Следующий вопрос',
            callback_data: 'next_question'
          }
        ]
      ]
    };

    await bot.editMessageReplyMarkup(keyboard, {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  } catch (error) {
    console.error('Ошибка при обработке ответа:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
  }
}

// Показ ответа/объяснения
export async function showAnswer(bot, query, questionId) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;

  try {
    const user = dbQueries.getUser.get(userId);
    if (!user) return;

    const questions = loadQuestions(user.subject);
    const question = questions.find(q => q.id === questionId);

    if (!question) {
      await bot.answerCallbackQuery(query.id, { text: 'Вопрос не найден' });
      return;
    }

    let answerText = '💡 <b>Ответ и объяснение:</b>\n\n';

    if (question.type === 'test') {
      const correctAnswer = question.options[question.correctAnswer];
      answerText += `✅ Правильный ответ: ${correctAnswer}\n\n`;
    }

    if (question.answer) {
      answerText += question.answer;
    }

    if (question.explanation) {
      answerText += `\n\n📖 <b>Объяснение:</b>\n${question.explanation}`;
    }

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, answerText, { parse_mode: 'HTML' });

    // Обновляем клавиатуру
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '➡️ Следующий вопрос',
            callback_data: 'next_question'
          }
        ]
      ]
    };

    await bot.editMessageReplyMarkup(keyboard, {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  } catch (error) {
    console.error('Ошибка при показе ответа:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
  }
}

// Обработка запроса следующего вопроса
export async function handleNextQuestion(bot, query) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;

  try {
    const user = dbQueries.getUser.get(userId);
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: 'Сначала используй /start' });
      return;
    }

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, '📝 Загружаю следующий вопрос...');
    await sendQuestionToUser(bot, user);
  } catch (error) {
    console.error('Ошибка при получении следующего вопроса:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
  }
}
