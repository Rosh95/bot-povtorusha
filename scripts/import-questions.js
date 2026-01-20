#!/usr/bin/env node

/**
 * Скрипт для массового импорта вопросов из CSV или другого JSON файла
 * Использование: node scripts/import-questions.js [файл-источник] [предмет]
 * 
 * Формат CSV (для тестовых вопросов):
 * topic,question,option1,option2,option3,option4,correctAnswer,answer,explanation
 * 
 * Формат JSON: массив объектов с вопросами
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const questionsPath = join(__dirname, '..', 'questions');

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const questions = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const question = {};
    
    headers.forEach((header, index) => {
      question[header] = values[index] || '';
    });
    
    // Преобразуем в формат бота
    if (question.option1) {
      question.type = 'test';
      question.options = [
        question.option1,
        question.option2,
        question.option3,
        question.option4
      ].filter(opt => opt);
      
      question.correctAnswer = parseInt(question.correctAnswer) || 0;
      delete question.option1;
      delete question.option2;
      delete question.option3;
      delete question.option4;
    } else {
      question.type = 'open';
    }
    
    // Генерируем ID если его нет
    if (!question.id) {
      question.id = `imported_${i}`;
    }
    
    questions.push(question);
  }
  
  return questions;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Использование: node scripts/import-questions.js [файл] [предмет]');
    console.log('Пример: node scripts/import-questions.js questions.csv math');
    process.exit(1);
  }
  
  const [sourceFile, subject] = args;
  
  try {
    const content = readFileSync(sourceFile, 'utf-8');
    const ext = extname(sourceFile).toLowerCase();
    
    let newQuestions = [];
    
    if (ext === '.csv') {
      newQuestions = parseCSV(content);
    } else if (ext === '.json') {
      newQuestions = JSON.parse(content);
    } else {
      console.error('❌ Поддерживаются только CSV и JSON файлы');
      process.exit(1);
    }
    
    // Загружаем существующие вопросы
    const targetFile = join(questionsPath, `${subject}.json`);
    let existingQuestions = [];
    
    try {
      const existing = readFileSync(targetFile, 'utf-8');
      existingQuestions = JSON.parse(existing);
    } catch (error) {
      // Файл не существует, создадим новый
    }
    
    // Добавляем новые вопросы
    const allQuestions = [...existingQuestions, ...newQuestions];
    
    // Сохраняем
    writeFileSync(targetFile, JSON.stringify(allQuestions, null, 2) + '\n', 'utf-8');
    
    console.log(`✅ Импортировано ${newQuestions.length} вопросов в ${subject}.json`);
    console.log(`📊 Всего вопросов: ${allQuestions.length}`);
    console.log(`\n💡 Проверьте валидность: npm run validate ${subject}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();
