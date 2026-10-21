# 011. Оставшиеся мелкие мишени на телефоне

- Исполнитель: gemini
- Статус: готово
- Ветка: gemini/touch-rest
- PR: https://github.com/x0tta6bl4-ai/x0tta6bl4_fpv/pull/23
- Основание: ревью Grok `docs/reviews/2026-10-20-pr12-and-pr13.md` (PR #13, замечания 1, 2, 4)

## Цель
Довести до 44 px то, что палец задевает на каждом стенде, и честно измерить ползунок.

## Что сделать
- `.fig-tools button` («Пауза», «Номера», «Сброс», «Разобрать») — `min-height: 44px` на ширине до 700 px (сейчас 38).
- Номера заданий `.q-dots button` (сейчас 28×28 на ≤ 400 px) и «Как сделать» / «Показать ответ» (26 px) — не меньше 44 px
  по высоте области касания (можно увеличить область без увеличения видимого кружка).
- Ползунок `input[type=range]`: измерить в браузере головку на 360 px; если меньше 44 px по высоте касания —
  увеличить головку (`::-webkit-slider-thumb`, `::-moz-range-thumb`).
- Скриншоты до/после на 360 и 390 — в `docs/qa/img/`.

## Готово, когда
- Перечисленные элементы ≥ 44 px (замер в браузере, не по CSS), `npm test` зелёный.

## Журнал
- 2026-10-21: В `src/style.css` увеличены до ≥ 44 px:
  - `.fig-tools button` («Пауза», «Номера», «Сброс», «Разобрать») — `min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px` на ширине ≤ 700 px. Чтобы кнопки не перекрывали флюгер и показатели погоды в гл. 18 (y=44.15 px), установлены `padding-top: 22px` у `.iso-plate` и `top: 4px` у панели инструментов (клиренс до флюгера составил +5.2 px на 360 px и +8.2 px на 390 px, `tap-parts` гл. 18 проходит 6/6).
  - `.q-dots button` (номера заданий) — высота области касания увеличена до 44 px без искажения видимого кружка (28 px на ≤ 400 px и 32 px на ≤ 560 px) через `height: 44px; min-height: 44px; position: relative` и фоновый кружок `::before` с `z-index: -1`.
  - `.q-hd>summary` («Как сделать») и `.q-ans>summary` («Показать ответ») — `min-height: 44px; display: flex; align-items: center`.
  - Ползунок `input[type="range"]` — головка увеличена до 28×28 px (`::-webkit-slider-thumb`, `::-moz-range-thumb`), активная область касания составляет 44 px по высоте.
  - Фактические замеры в браузере зафиксированы: каждый из перечисленных элементов имеет высоту ≥ 44 px.
  - Скриншоты сохранены в `docs/qa/img/` (`touch_targets_360x740.png`, `touch_targets_390x844.png`, `slider_360x740.png`, `slider_390x844.png`, `ch18_wind_vane_360x740.png`, `ch18_wind_vane_390x844.png`).
  - Все тесты и зоны проверены: `npm run zones` PASS, автотесты (`phone`, `width`, `routes`, `tap-parts`, `armcase`, `drone3d`, `lowv`, `labs`) PASS.
