# Деплой backend-harmony на VPS

**VPS:** `147.45.243.157` (root по SSH)  
**Репозиторий:** `git@github.com:lobzik223/backend-harmony.git`

---

## 1. У себя: отправить код в GitHub

Если ещё не пушили репозиторий:

```powershell
cd C:\Users\pc\Desktop\Harmony-App\backend-harmony
git remote add origin git@github.com:lobzik223/backend-harmony.git
git push -u origin main
```

Если remote уже есть — просто:

```powershell
git push origin main
```

(Замените `main` на `master`, если у вас такая ветка.)

---

## 2. На сервере: один раз установить Git и Docker

Подключитесь к VPS:

```bash
ssh root@147.45.243.157
```

Затем выполните (для Ubuntu/Debian):

```bash
# Обновление пакетов
apt update && apt upgrade -y

# Git
apt install -y git

# Docker (официальный способ)
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION_COPYNAME}") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Проверка
git --version
docker --version
docker compose version
```

Для других дистрибутивов (CentOS, AlmaLinux и т.д.) — см. https://docs.docker.com/engine/install/

---

## 3. На сервере: клонировать репозиторий и запустить

**Вариант A: по SSH (нужен ключ на сервере в GitHub)**

Сначала добавьте SSH-ключ сервера в GitHub (Deploy key или свой ключ в аккаунте):

```bash
# На сервере сгенерировать ключ (если нет)
ssh-keygen -t ed25519 -C "vps-harmony" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# Этот ключ добавить в GitHub: Settings → Deploy keys или SSH keys
```

Клонирование и запуск:

```bash
cd /root
git clone git@github.com:lobzik223/backend-harmony.git
cd backend-harmony
cp env.docker.example .env
nano .env   # задать сильные JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, APP_KEY и при необходимости CORS_ORIGIN
docker compose up -d --build
```

**Вариант B: по HTTPS (без SSH-ключа на сервере)**

```bash
cd /root
git clone https://github.com/lobzik223/backend-harmony.git
cd backend-harmony
cp env.docker.example .env
nano .env   # задать секреты
docker compose up -d --build
```

---

## 4. Проверка на VPS

```bash
docker compose ps
curl -s http://127.0.0.1:3000/api/health
```

Снаружи: `http://147.45.243.157:3000/api/health` (если порт 3000 открыт в файрволе).

---

## 5. Обновление после изменений в GitHub

На сервере:

```bash
cd /root/backend-harmony
git pull origin main
docker compose up -d --build
```

---

## Кратко: одна команда для клона и запуска (после установки Git и Docker)

```bash
cd /root && git clone https://github.com/lobzik223/backend-harmony.git && cd backend-harmony && cp env.docker.example .env && docker compose up -d --build
```

Не забудьте потом отредактировать `.env` и задать свои секреты для production.
