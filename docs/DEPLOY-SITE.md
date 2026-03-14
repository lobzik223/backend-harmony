# Деплой лендинга harmonymeditation.online (Harmony-site)

Чтобы на **harmonymeditation.online** открывался ваш лендинг (подписка Premium, тарифы, ссылки на приложение), а не заглушка «Harmony», нужно выложить сборку **Harmony-site** на сервер.

## 1. Сборка лендинга (локально)

В каталоге проекта **Harmony-site**:

```bash
cd Harmony-site
npm install
npm run build
```

В результате появится папка **dist/** с файлами: `index.html`, `assets/`, при необходимости `harmonyicon.png` (если он лежит в `public/`).

## 2. Загрузка на сервер

Содержимое папки **dist** нужно разместить на сервере в каталоге **/var/www/harmony-site** (создайте его при необходимости).

Пример через SCP (с вашего компьютера):

```bash
# Создать каталог на сервере (один раз)
ssh root@147.45.243.157 "mkdir -p /var/www/harmony-site"

# Загрузить содержимое dist
scp -r Harmony-site/dist/* root@147.45.243.157:/var/www/harmony-site/
```

Или скопируйте файлы через SFTP/FTP-клиент в `/var/www/harmony-site/`.

Права доступа (на сервере):

```bash
sudo chown -R www-data:www-data /var/www/harmony-site
sudo chmod -R 755 /var/www/harmony-site
```

## 3. Конфигурация Caddy

В **Caddyfile** для `harmonymeditation.online` и `http://harmonymeditation.online` должен быть указан каталог сайта и раздача статики (см. **Caddyfile-full.conf**):

- `root * /var/www/harmony-site`
- `file_server`
- при 404 — отдача `index.html` (для будущих маршрутов SPA, если появятся)

Скопируйте актуальный Caddyfile на сервер в `/etc/caddy/Caddyfile`, затем:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

После этого **https://harmonymeditation.online** и **http://harmonymeditation.online** будут отдавать ваш лендинг.

## 4. Обновление сайта

При любых изменениях в Harmony-site:

1. Локально: `npm run build`
2. Загрузить новое содержимое **dist** в `/var/www/harmony-site/` (можно заменить все файлы в каталоге).

Reload Caddy не нужен — он отдаёт статику из каталога.
