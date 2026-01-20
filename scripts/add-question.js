#!/usr/bin/env node

/**
 * Интерактивный скрипт для добавления вопросов
 * Использование: node scripts/add-question.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Список предметов
const subjects = {
  math: 'Математика',
  russian: 'Русский язык',
  physics: 'Физика',
  social: 'Обществознание',
  history: 'История'
};

async function selectSubject() {
  console.log('\n📚 Выбери предмет:');
  const entries = Object.entries(subjects);
  entries.forEach(([key, name], index) => {
    console.log(`${index + 1}. ${name} (${key})`);
  });
  
  const choice = await question('\nВведи номер предмета: ');
  const index = parseInt(choice) - 1;
  
  if (index >= 0 && index < entries.length) {
    return entries[index][0];
  }
  
  console.log('❌ Неверный выбор, используем математику по умолчанию');
  return 'math';
}

async function getQuestionData() {
  console.log('\n📝 Заполни данные вопроса:\n');
  
  const subject = await selectSubject();
  
  // Загружаем существующие вопросы для генерации ID
  const questionsPath = join(__dirname, '..', 'questions', `${subject}.json`);
  let existingQuestions = [];
  try {
    const content = readFileSync(questionsPath, 'utf-8');
    existingQuestions = JSON.parse(content);
  } catch (error) {
    // Файл не существует, создадим новый
  }
  
  const nextId = existingQuestions.length + 1;
  const defaultId = `${subject}_${nextId}`;
  
  const id = await question(`ID вопроса (Enter для ${defaultId}): `) || defaultId;
  const topic = await question('Тема вопроса: ');
  const questionText = await question('Текст вопроса: ');
  
  const type = await question('Тип вопроса (test/open, Enter для test): ') || 'test';
  
  let options = [];
  let correctAnswer = null;
  
  if (type === 'test') {
    console.log('\nВведи варианты ответов (минимум 2, максимум 6):');
    let optionNum = 1;
    while (optionNum <= 6) {
      const option = await question(`Вариант ${optionNum} (Enter для завершения): `);
      if (!option && optionNum >= 2) break;
      if (option) {
        options.push(option);
        optionNum++;
      } else if (optionNum === 1) {
        console.log('❌ Нужно минимум 2 варианта ответа!');
        continue;
      }
    }
    
    if (options.length < 2) {
      console.log('❌ Ошибка: нужно минимум 2 варианта ответа');
      process.exit(1);
    }
    
    console.log('\nВарианты ответов:');
    options.forEach((opt, idx) => {
      console.log(`${idx + 1}. ${opt}`);
    });
    
    const correct = await question(`Номер правильного ответа (1-${options.length}): `);
    correctAnswer = parseInt(correct) - 1;
    
    if (correctAnswer < 0 || correctAnswer >= options.length) {
      console.log('❌ Неверный номер, используем первый вариант');
      correctAnswer = 0;
    }
  }
  
  const answer = await question('Краткий ответ: ') || '';
  const explanation = await question('Объяснение (Enter для пропуска): ') || '';
  
  return {
    subject,
    question: {
      id,
      topic,
      type,
      question: questionText,
      ...(type === 'test' && { options, correctAnswer }),
      ...(answer && { answer }),
      ...(explanation && { explanation })
    }
  };
}

async function saveQuestion(subject, newQuestion) {
  const questionsPath = join(__dirname, '..', 'questions', `${subject}.json`);
  
  let questions = [];
  try {
    const content = readFileSync(questionsPath, 'utf-8');
    questions = JSON.parse(content);
  } catch (error) {
    // Файл не существует
  }
  
  // Проверяем, нет ли вопроса с таким ID
  if (questions.some(q => q.id === newQuestion.id)) {
    const overwrite = await question(`\n⚠️  Вопрос с ID "${newQuestion.id}" уже существует. Перезаписать? (y/n): `);
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ Отменено');
      return false;
    }
    questions = questions.filter(q => q.id !== newQuestion.id);
  }
  
  questions.push(newQuestion);
  
  // Сохраняем с красивым форматированием
  writeFileSync(questionsPath, JSON.stringify(questions, null, 2) + '\n', 'utf-8');
  
  console.log(`\n✅ Вопрос сохранен в questions/${subject}.json`);
  console.log(`📊 Всего вопросов в файле: ${questions.length}`);
  
  return true;
}

async function main() {
  console.log('🤖 Добавление вопроса для бота "ВопросДня от Повторюши"\n');
  
  try {
    const { subject, question: newQuestion } = await getQuestionData();
    
    console.log('\n📋 Предпросмотр вопроса:');
    console.log(JSON.stringify(newQuestion, null, 2));
    
    const confirm = await question('\nСохранить вопрос? (y/n): ');
    
    if (confirm.toLowerCase() === 'y') {
      await saveQuestion(subject, newQuestion);
      console.log('\n🎉 Готово! Вопрос добавлен.');
    } else {
      console.log('❌ Отменено');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    rl.close();
  }
}

main();
