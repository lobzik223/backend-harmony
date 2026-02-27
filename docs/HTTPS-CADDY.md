# HTTPS для api.harmonymeditation.online (Caddy + Let's Encrypt)

На сервере перед бэкендом ставится **Caddy**: он принимает HTTPS на 443, получает бесплатный сертификат Let's Encrypt и проксирует запросы на бэкенд (порт 3000).

---

## 1. Установка Caddy (на сервере)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

---

## 2. Конфиг Caddy

Создать/отредактировать конфиг:

```bash
sudo nano /etc/caddy/Caddyfile
```

**Содержимое (подставь свой домен):**

```
api.harmonymeditation.online {
    reverse_proxy 127.0.0.1:3000
}
```

Сохранить (Ctrl+O, Enter), выйти (Ctrl+X).

---

## 3. Проверка и запуск

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl enable caddy
sudo systemctl status caddy
```

При первом запуске Caddy сам запросит сертификат Let's Encrypt для `api.harmonymeditation.online` (домен должен указывать на IP сервера).

---

## 4. Открыть порты 80 и 443

Если включён UFW:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Если файрвол в панели хостинга — открыть входящие TCP 80 и 443.

---

## 5. Проверка HTTPS

В браузере открыть:

**https://api.harmonymeditation.online/api/health**

Должен быть JSON и замок «Защищено» в адресной строке.

---

## 6. (Опционально) Закрыть порт 3000 снаружи

Чтобы к API можно было обращаться только через HTTPS (443), порт 3000 можно не открывать в интернет. В docker-compose порт уже проброшен на хост; если UFW включён:

```bash
sudo ufw delete allow 3000/tcp
sudo ufw reload
```

Локально Caddy по-прежнему обращается к `127.0.0.1:3000`.

---

## В приложении

Базовый URL API сменить на:

**https://api.harmonymeditation.online/api**

(без порта `:3000`).
