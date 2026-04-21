# CSS Visual Baseline

Этот документ фиксирует текущее визуальное состояние интерфейса. Дальнейшая оптимизация CSS допускается только при сохранении этого рендера.

## Правило изменений

- Оптимизация может упрощать каскад, удалять дубли, выносить значения в токены и объединять селекторы.
- Оптимизация не должна менять текущий вид компонентов в `aurora` и `midnight`.
- Если старый theme-block удаляется, эквивалентный визуальный результат должен уже задаваться более поздним token-layer или semantic override.
- При сомнении приоритет у сохранения текущего UI, а не у дополнительной чистки CSS.

## Источники истины

### Глобальная тема

- Основной token-layer приложения находится в `src/App.css` в секции `Theme Token System`.
- Глобальные visual tokens покрывают header, toolbar, calendar day cells, list/week cards, activity chips, buttons, modal/forms.
- Для дальнейших правок сначала меняются `--theme-*` переменные, а не старые theme-specific селекторы выше по файлу.

### Личный кабинет

- Основной token-layer кабинета находится в `src/components/PersonalCabinet.css`.
- Cabinet tokens (`--cabinet-*`) задают поверхности, панели, элементы управления, event cards и `past-panel`.
- Финальный блок `Semantic State Overrides` в конце `src/components/PersonalCabinet.css` считается каноническим местом для state-цветов (`warning` и следующие состояния по мере переноса).

## Визуальные инварианты

### Light theme (`midnight`)

- Интерфейс остаётся светлым glassmorphism-слоем: бело-голубые поверхности, мягкие синие границы, без ухода в тёмные или серые панели.
- Calendar toolbar, cards, forms и modal surfaces остаются светло-голубыми и полупрозрачными.
- `warning` в cabinet должен быть визуально теплее соседних `primary/neutral` блоков и считываться как amber/accent section, а не как обычная бело-голубая карточка.
- `past-panel` остаётся светлой выдвижной панелью с голубыми controls и мягкой глубиной.

### Dark theme (`aurora`)

- Интерфейс остаётся тёмным navy-glass слоем с холодными сине-циановыми акцентами.
- Calendar and cabinet surfaces сохраняют глубокие сине-индиговые подложки с полупрозрачными светлыми границами.
- Тёплые `warning`/project accents остаются приглушёнными amber/bronze, без кислотных жёлто-оранжевых оттенков.
- `past-panel` остаётся заметно темнее light theme и не должен переносить светлые значения из `midnight`.

## Компонентные инварианты

- Навигация `Календарь / Личный кабинет` должна быть стилизована без зависимости от lazy-loaded CSS.
- Month day cells в календаре сохраняют card-like вид, distinct selected/today states и отдельный badge/counter.
- Right-side activities summary card и week/list cards сохраняют общую glass-panel эстетику.
- Cabinet block `Требует внимания` сохраняет три явно различимых tone-секции: `warning`, `primary`, `danger`.
- В `warning`-секции должны сохраняться:
  - отдельный тёплый фон блока;
  - тёплый border/accent;
  - отличимый icon chip;
  - более тёплая типографика по сравнению с neutral/light cards.

## Правило удаления legacy CSS

- Удалять старый theme-specific блок можно только если:
  - текущий вид уже повторён через token-layer или final override;
  - source of truth находится ниже по каскаду;
  - визуал проверен хотя бы сборкой и локальным осмотром соответствующей зоны.
- Нельзя одновременно переносить state в новый слой и в том же шаге удалять соседние unrelated legacy-блоки.
- Предпочтительный порядок миграции:
  1. Вынести state/tone в final override.
  2. Подтвердить, что итоговый рендер не изменился.
  3. Удалить только legacy-блоки этого же state/tone.

## Минимальная проверка после CSS-рефактора

- `npm run build`
- Быстрый визуальный просмотр:
  - calendar month view
  - calendar toolbar
  - cabinet `Требует внимания`
  - `past-panel`
  - modal/report form

Если визуал не подтверждён, рефактор считается незавершённым, даже если CSS стал чище.