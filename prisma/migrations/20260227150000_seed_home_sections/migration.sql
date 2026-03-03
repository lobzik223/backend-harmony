-- Секции главного экрана приложения: Гармония, Расслабление, Осознанность, Энергия.
-- Если секция с таким slug уже есть — не перезаписываем.
INSERT INTO "ContentSection" (id, name, slug, type, "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Гармония', 'garmoniya', 'HOME', 10, NOW(), NOW()),
  (gen_random_uuid(), 'Расслабление', 'rasslablenie', 'HOME', 11, NOW(), NOW()),
  (gen_random_uuid(), 'Осознанность', 'osoznannost', 'HOME', 12, NOW(), NOW()),
  (gen_random_uuid(), 'Энергия', 'energiya', 'HOME', 13, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
