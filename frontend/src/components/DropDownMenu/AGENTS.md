# DropDownMenu

Назначение: универсальный контекстный поповер‑меню с поддержкой вложенных меню и встроенных компонентов (подтверждения, формы и т.д.).

## Основные файлы
- DropDownMenu.tsx: основной компонент меню (Popover + список пунктов, поддержка вложенности).
- DropDownMenuConfirm.tsx: готовый блок подтверждения действия для меню.
- DropDownMenuPrompt.tsx: готовый блок запроса ввода/подтверждения.
- types.ts: типы для конфигурации меню и пропсов.
- AGENTS.md: описание и примеры использования.

## Быстрый старт

Минимальный пример:
```tsx
const menu = {
  title: "Действия",
  items: [
    { text: "Просмотр", action: () => console.log("view") },
    { text: "Скачать", action: () => console.log("download") },
  ],
};

<DropDownMenu
  open={open}
  onClose={() => setOpen(false)}
  menu={menu}
  anchorEl={anchorEl}
  width={180}
/>;
```

## Вложенное меню
```tsx
const menu = {
  title: "Действия",
  items: [
    {
      text: "Дополнительно",
      nested: {
        title: "Дополнительно",
        items: [{ text: "Печать", action: onPrint }],
      },
    },
  ],
};
```

## Подтверждение удаления
```tsx
const menu = {
  title: "Удаление",
  items: [
    {
      Component: (
        <DropDownMenuConfirm
          text="Удалить позицию?"
          i18n={{ cancelLabel: "Отмена", confirmLabel: "Удалить" }}
          cancelBtnProps={{ onClick: onClose }}
          confirmBtnProps={{ onClick: onDelete, color: "error" }}
        />
      ),
    },
  ],
};
```

## Полезные параметры
- open / onClose: управление показом.
- anchorEl / anchorPosition: позиционирование меню.
- width / maxHeight: размеры меню.
- showNestedChevron: показать стрелку для вложенных пунктов.

## Примечания
- Меню автоматически закрывается при выборе пункта (если не вложенное и без Component).
- Для кастомного содержимого используйте `Component` в `DropDownMenuItem`.
