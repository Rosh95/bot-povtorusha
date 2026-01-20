#!/bin/bash

# Скрипт для первоначальной настройки VPS
# Использование: ./scripts/setup-vps.sh

echo "🔧 Настройка VPS для бота..."

# Обновление системы
echo "📦 Обновление системы..."
sudo apt update && sudo apt upgrade -y

# Установка Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Установка Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js уже установлен: $(node -v)"
fi

# Установка PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Установка PM2..."
    sudo npm install -g pm2
else
    echo "✅ PM2 уже установлен"
fi

# Установка Git
if ! command -v git &> /dev/null; then
    echo "📦 Установка Git..."
    sudo apt install -y git
else
    echo "✅ Git уже установлен"
fi

# Создание директории для бота
echo "📁 Создание директории..."
mkdir -p ~/bot-povtorusha
cd ~/bot-povtorusha

echo "✅ Настройка завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Загрузите файлы проекта в ~/bot-povtorusha"
echo "2. Создайте .env файл с BOT_TOKEN"
echo "3. Запустите: npm install"
echo "4. Запустите: pm2 start ecosystem.config.js"
echo "5. Сохраните: pm2 save && pm2 startup"
