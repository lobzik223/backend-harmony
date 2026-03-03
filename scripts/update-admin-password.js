#!/usr/bin/env node
/**
 * Смена пароля существующего админа.
 * Использование: node scripts/update-admin-password.js <email> <новый_пароль>
 * Или: EMAIL=admin@example.com PASSWORD=secret node scripts/update-admin-password.js
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
    console.error('Использование: node scripts/update-admin-password.js <email> <новый_пароль>');
    console.error('Или: EMAIL=admin@example.com PASSWORD=secret node scripts/update-admin-password.js');
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(email);
  validatePassword(password);

  const admin = await prisma.admin.findUnique({
    where: { email: normalizedEmail },
  });
  if (!admin) {
    console.error('Админ с таким email не найден.');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash },
  });

  console.log('Пароль обновлён для: %s', admin.email);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
