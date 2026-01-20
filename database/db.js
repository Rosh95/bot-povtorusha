import Database from 'better-sqlite3';
import { config } from '../config.js';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

// Создаем директорию для БД, если её нет
const dbDir = dirname(config.databasePath);
mkdirSync(dbDir, { recursive: true });

const db = new Database(config.databasePath);

// Создание таблицы users
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    username TEXT,
    subject TEXT DEFAULT 'math',
    notification_time TEXT DEFAULT '09:00',
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Создание таблицы для статистики
db.exec(`
  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id TEXT,
    subject TEXT,
    answered_correctly BOOLEAN,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`);

// Создание таблицы для отслеживания отправленных вопросов
db.exec(`
  CREATE TABLE IF NOT EXISTS sent_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    reminder_sent BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`);

// Подготовленные запросы
export const dbQueries = {
  // Пользователи
  getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
  createUser: db.prepare(`
    INSERT INTO users (user_id, chat_id, username, subject, notification_time, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `),
  updateUser: db.prepare(`
    UPDATE users 
    SET username = ?, subject = ?, notification_time = ?, is_active = ?
    WHERE user_id = ?
  `),
  updateSubject: db.prepare('UPDATE users SET subject = ? WHERE user_id = ?'),
  updateTime: db.prepare('UPDATE users SET notification_time = ? WHERE user_id = ?'),
  updateActive: db.prepare('UPDATE users SET is_active = ? WHERE user_id = ?'),
  getAllActiveUsers: db.prepare('SELECT * FROM users WHERE is_active = 1'),
  getUsersByTime: db.prepare('SELECT * FROM users WHERE notification_time = ? AND is_active = 1'),
  
  // Статистика
  addStat: db.prepare(`
    INSERT INTO user_stats (user_id, question_id, subject, answered_correctly)
    VALUES (?, ?, ?, ?)
  `),
  getUserStats: db.prepare(`
    SELECT 
      COUNT(*) as total_questions,
      SUM(CASE WHEN answered_correctly = 1 THEN 1 ELSE 0 END) as correct_answers
    FROM user_stats
    WHERE user_id = ?
  `),
  
  // Отправленные вопросы
  addSentQuestion: db.prepare(`
    INSERT INTO sent_questions (user_id, question_id, subject)
    VALUES (?, ?, ?)
  `),
  markQuestionAnswered: db.prepare(`
    UPDATE sent_questions 
    SET answered_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND question_id = ? AND answered_at IS NULL
  `),
  markReminderSent: db.prepare(`
    UPDATE sent_questions 
    SET reminder_sent = 1
    WHERE user_id = ? AND question_id = ?
  `),
  // Для этого запроса нужно использовать функцию, так как SQLite не поддерживает параметры в модификаторах времени
  getUnansweredQuestions: (userId, hours) => {
    return db.prepare(`
      SELECT * FROM sent_questions
      WHERE user_id = ? 
      AND answered_at IS NULL 
      AND reminder_sent = 0
      AND datetime(sent_at) < datetime('now', '-' || ? || ' hours')
    `).all(userId, hours.toString());
  }
};

export default db;
