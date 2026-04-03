
/**
 * Ячейка дня в календарной сетке.
 *
 * @param {Object} props Свойства компонента.
 * @param {number|null} props.day День месяца или `null` для пустой ячейки.
 * @param {boolean} props.isToday Флаг текущего дня.
 * @param {boolean} props.isSelected Флаг выбранного дня.
 * @param {boolean} props.hasEvents Наличие активностей в дне.
 * @param {Array<'internal' | 'external'>} props.eventTypes Типы активностей для индикаторов.
 * @param {(day: number) => void} props.onClick Обработчик клика по дню.
 * @returns {JSX.Element} JSX ячейки дня.
 */

function CalendarDay({ day, isToday, isSelected, hasEvents, eventTypes, onClick }) {
  if (!day) {
    return <div className="day empty"></div>;
  }

  const classNames = ['day'];
  if (isToday) classNames.push('today');
  if (isSelected) classNames.push('selected');
  if (hasEvents) classNames.push('has-events');

  return (
    <div 
      className={classNames.join(' ')}
      onClick={() => onClick(day)}
    >
      {day}
      {hasEvents && eventTypes.length > 0 && (
        <div className="day-indicators">
          {eventTypes.includes('internal') && (
            <span className="day-indicator day-indicator--internal"></span>
          )}
          {eventTypes.includes('external') && (
            <span className="day-indicator day-indicator--external"></span>
          )}
        </div>
      )}
    </div>
  );
}

export default CalendarDay;