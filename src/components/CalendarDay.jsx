
/**
 * Ячейка дня в календарной сетке.
 *
 * @param {Object} props Свойства компонента.
 * @param {number|null} props.day День месяца или `null` для пустой ячейки.
 * @param {boolean} props.isToday Флаг текущего дня.
 * @param {boolean} props.isSelected Флаг выбранного дня.
 * @param {boolean} props.hasEvents Наличие активностей в дне.
 * @param {number} props.eventCount Количество активностей в дне.
 * @param {Array<'internal' | 'external'>} props.eventTypes Типы активностей для индикаторов.
 * @param {(day: number) => void} props.onClick Обработчик клика по дню.
 * @returns {JSX.Element} JSX ячейки дня.
 */

function CalendarDay({ day, isToday, isSelected, hasEvents, eventCount, eventTypes, onClick }) {
  if (!day) {
    return <div className="day empty"></div>;
  }

  const classNames = ['day'];
  if (isToday) classNames.push('today');
  if (isSelected) classNames.push('selected');
  if (hasEvents) classNames.push('has-events');

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      onClick={() => onClick(day)}
    >
      <span className="day__top">
        <span className="day__number">{day}</span>
        {hasEvents && (
          <span className="day__badge">
            {eventCount}
          </span>
        )}
      </span>

      <span className="day__bottom">
        {hasEvents && eventTypes.length > 0 && (
          <span className="day-indicators">
            {eventTypes.includes('internal') && (
              <span className="day-indicator day-indicator--internal"></span>
            )}
            {eventTypes.includes('external') && (
              <span className="day-indicator day-indicator--external"></span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

export default CalendarDay;