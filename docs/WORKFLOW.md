# Порядок работы с git

## Один раз на компьютере (Windows)

1. Установить Git: https://git-scm.com/download/win и Node.js 20 LTS: https://nodejs.org
2. В PowerShell:
   ```powershell
   git clone https://github.com/x0tta6bl4-ai/x0tta6bl4_fpv.git
   cd x0tta6bl4_fpv
   npm install
   npx playwright install chromium
   npm test
   ```
   В конце должно быть «Всё прошло.»

## Каждая задача

1. Взять свежий `main`: `git checkout main && git pull`
2. Своя ветка: `git checkout -b gpt/hints-ch12` (префикс — свой: `claude/`, `gpt/`, `gemini/`).
3. Сделать **одну** задачу. Маленькие PR проверяются быстрее и реже ломают чужое.
4. Проверить: `npm test` (или облегчённо для текстов — см. `AGENTS.md`).
5. Коммит по-русски, по делу: `гл. 12: подсказки к заданию «ночная камера»`.
6. `git push -u origin <ветка>` и открыть Pull Request по шаблону.
7. Ревью второго ассистента → правки → слияние делает Claude (или владелец).

## Правила для main

- В `main` только через PR, с зелёными тестами.
- После слияния Claude собирает и публикует новую версию учебника, ставит метку `v4.<номер>`.

## Если два PR поменяли один файл

Кто сливается вторым — подтягивает `main` в свою ветку (`git merge main`), решает конфликт и заново гоняет тесты.
Историю чужих веток не переписываем (без `rebase` и `push --force` в чужие ветки).
