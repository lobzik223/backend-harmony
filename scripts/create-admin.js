#!/usr/bin/env node
/**
 * Создание админ-аккаунта только из консоли сервера.
 * Использование: node scripts/create-admin.js <email> <password>
 * Или: EMAIL=admin@example.com PASSWORD=secret node scripts/create-admin.js
 *
 * Пароль хэшируется argon2, в БД хранится только хэш.
 */

const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

function normalizeEmail(email) {
  const v = String(email ?? '').trim().toLowerCase().slice(0, 254);
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw new Error('Некорректный формат email');
  }
  return v;
}

function validatePassword(password) {
  const v = String(password ?? '');
  if (v.length < 8 || v.length > 200) {
    throw new Error('Пароль должен быть от 8 до 200 символов');
  }
  if (/[\x00-\x1f\x7f]/.test(v)) {
    throw new Error('Недопустимые символы в пароле');
  }
}

async function main() {
  const email = process.env.EMAIL || process.argv[2];
  const password = process.env.PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error('Использование: node scripts/create-admin.js <email> <password>');
    console.error('Или: EMAIL=admin@example.com PASSWORD=secret node scripts/create-admin.js');
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(email);
  validatePassword(password);

  const existing = await prisma.admin.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    console.error('Админ с таким email уже существует.');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await prisma.admin.create({
    data: { email: normalizedEmail, passwordHash },
  });

  console.log('Админ создан: id=%s email=%s', admin.id, admin.email);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
