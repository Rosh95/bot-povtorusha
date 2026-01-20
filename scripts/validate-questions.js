#!/usr/bin/env node

/**
 * Валидатор вопросов - проверяет корректность JSON файлов с вопросами
 * Использование: node scripts/validate-questions.js [предмет]
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const questionsPath = join(__dirname, '..', 'questions');

function validateQuestion(question, index) {
  const errors = [];
  const warnings = [];

  // Обязательные поля
  if (!question.id) {
    errors.push(`Вопрос #${index}: отсутствует поле "id"`);
  }
  
  if (!question.topic) {
    warnings.push(`Вопрос #${index}: отсутствует поле "topic"`);
  }
  
  if (!question.type) {
    errors.push(`Вопрос #${index}: отсутствует поле "type"`);
  } else if (!['test', 'open'].includes(question.type)) {
    errors.push(`Вопрос #${index}: неверный тип "${question.type}" (должен быть "test" или "open")`);
  }
  
  if (!question.question) {
    errors.push(`Вопрос #${index}: отсутствует поле "question"`);
  }

  // Проверка для тестовых вопросов
  if (question.type === 'test') {
    if (!question.options || !Array.isArray(question.options)) {
      errors.push(`Вопрос #${index}: отсутствует массив "options"`);
    } else {
      if (question.options.length < 2) {
        errors.push(`Вопрос #${index}: должно быть минимум 2 варианта ответа`);
      }
      if (question.options.length > 6) {
        warnings.push(`Вопрос #${index}: слишком много вариантов ответа (${question.options.length})`);
      }
      
      if (typeof question.correctAnswer !== 'number') {
        errors.push(`Вопрос #${index}: отсутствует или неверный "correctAnswer"`);
      } else if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
        errors.push(`Вопрос #${index}: "correctAnswer" вне диапазона (0-${question.options.length - 1})`);
      }
    }
  }

  // Проверка уникальности ID
  // (это будет проверяться на уровне всего файла)

  return { errors, warnings };
}

function validateFile(filePath) {
  console.log(`\n📄 Проверка файла: ${filePath}`);
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const questions = JSON.parse(content);
    
    if (!Array.isArray(questions)) {
      console.error('❌ Файл должен содержать массив вопросов');
      return false;
    }
    
    if (questions.length === 0) {
      console.warn('⚠️  Файл пуст');
      return true;
    }
    
    const allErrors = [];
    const allWarnings = [];
    const ids = new Set();
    
    questions.forEach((question, index) => {
      const { errors, warnings } = validateQuestion(question, index);
      allErrors.push(...errors);
      allWarnings.push(...warnings);
      
      // Проверка уникальности ID
      if (question.id) {
        if (ids.has(question.id)) {
          allErrors.push(`Вопрос #${index}: дублирующийся ID "${question.id}"`);
        }
        ids.add(question.id);
      }
    });
    
    // Вывод результатов
    if (allWarnings.length > 0) {
      console.log('\n⚠️  Предупреждения:');
      allWarnings.forEach(w => console.log(`  - ${w}`));
    }
    
    if (allErrors.length > 0) {
      console.log('\n❌ Ошибки:');
      allErrors.forEach(e => console.log(`  - ${e}`));
      return false;
    }
    
    console.log(`✅ Файл корректен! Вопросов: ${questions.length}`);
    return true;
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`❌ Ошибка парсинга JSON: ${error.message}`);
    } else {
      console.error(`❌ Ошибка чтения файла: ${error.message}`);
    }
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const subject = args[0];
  
  console.log('🔍 Валидация вопросов\n');
  
  if (subject) {
    // Проверка конкретного файла
    const filePath = join(questionsPath, `${subject}.json`);
    const isValid = validateFile(filePath);
    process.exit(isValid ? 0 : 1);
  } else {
    // Проверка всех файлов
    try {
      const files = readdirSync(questionsPath)
        .filter(f => f.endsWith('.json'));
      
      if (files.length === 0) {
        console.log('⚠️  Файлы с вопросами не найдены');
        return;
      }
      
      let allValid = true;
      files.forEach(file => {
        const filePath = join(questionsPath, file);
        if (!validateFile(filePath)) {
          allValid = false;
        }
      });
      
      console.log('\n' + '='.repeat(50));
      if (allValid) {
        console.log('✅ Все файлы валидны!');
      } else {
        console.log('❌ Обнаружены ошибки в файлах');
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Ошибка: ${error.message}`);
      process.exit(1);
    }
  }
}

main();
