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
2. Своя ветка: `git checkout -b gpt/hints-ch12` (префикс — свой: `claude/`, `gpt/`, `gemini/`, `grok/`).
   В карточке задачи (`docs/tasks/`) — статус «в работе».
3. Сделать **одну** задачу. Маленькие PR проверяются быстрее и реже ломают чужое.
4. Проверить: `npm run zones` и `npm test` (или облегчённо для текстов — см. `AGENTS.md`).
5. Коммит по-русски, по делу: `гл. 12: подсказки к заданию «ночная камера»`.
6. `git push -u origin <ветка>` и открыть Pull Request по шаблону. В карточке — «на ревью» и ссылка на PR.
7. Ревью второго ассистента → правки → слияние делает Claude (или владелец).

## Если ассистенты работают одновременно на одном ПК

Каждому — своя папка (git worktree), иначе они переключают ветки друг у друга под ногами:

```powershell
git config core.longpaths true
git worktree add ..\fpv-gpt    -b gpt/<задача>
git worktree add ..\fpv-gemini -b gemini/<задача>
```

В каждой папке один раз `npm install`. Полный `npm test` (~15 мин) тяжёлый — на одном ПК гоняйте его по очереди.
Убрать папку после слияния: `git worktree remove ..\fpv-gpt`.

## Метки PR (ставит владелец)

- `tests-reviewed` — изменения существующих тестов проверены вторым ассистентом или владельцем.
- `cross-zone` — правка чужой зоны согласована.

## Защита main (настраивает владелец один раз)

GitHub → Settings → Branches → Add rule для `main`: «Require a pull request before merging» (одобрений: 0),
«Require status checks to pass»: `test` и `zones`.

## Правила для main

- В `main` только через PR, с зелёными тестами.
- **Сайт** https://x0tta6bl4-ai.github.io/x0tta6bl4_fpv/ обновляется сам: после слияния в `main` проходят тесты
  (`tests`), затем `pages` собирает учебник и выкладывает его (~20 мин от слияния до сайта). Красный прогон сайт не трогает.
  Какая версия на сайте — `…/x0tta6bl4_fpv/version.txt`. Перезапуск вручную: Actions → pages → Run workflow.
- Приватную версию со сканами книги на claude.ai публикует Claude.

### Включить сайт (владелец, один раз)

GitHub → Settings → Pages → Build and deployment → Source: **GitHub Actions**. Затем Actions → pages → Run workflow.

## Если два PR поменяли один файл

Кто сливается вторым — подтягивает `main` в свою ветку (`git merge main`), решает конфликт и заново гоняет тесты.
Историю чужих веток не переписываем (без `rebase` и `push --force` в чужие ветки).
