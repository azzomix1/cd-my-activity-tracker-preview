import CalendarDay from './CalendarDay';
import { WEEKDAYS, getCalendarData, isToday, parseDate } from '../utils/dateUtils';

function isSameDay(left, right) {
  return left && right
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function getActivityPreview(activity) {
  const label = activity.person || activity.name || 'Активность';

  return activity.time ? `${activity.time} · ${label}` : label;
}


/**
 * Календарь месяца с навигацией, выбором дня и индикаторами активности.
 *
 * @param {Object} props Свойства компонента.
 * @param {number} props.currentYear Текущий год.
 * @param {number} props.currentMonth Текущий месяц (0-11).
 * @param {number|null} props.selectedDay Выбранный день месяца.
 * @param {Date|null} props.activeDate Активная дата для текущего режима.
 * @param {Record<number, import('../services/activitiesApi').Activity[]>} props.activitiesMap Активности по дням месяца.
 * @param {'month' | 'week' | 'list'} props.viewMode Активный режим отображения.
 * @param {{date: Date, activities: import('../services/activitiesApi').Activity[]}[]} props.weekActivities Активности по дням недели.
 * @param {import('../services/activitiesApi').Activity[]} props.listActivities Активности текущего месяца в виде списка.
 * @param {string} props.periodLabel Подпись текущего периода.
 * @param {(date: Date) => void} props.onDateSelect Выбор даты.
 * @param {(delta: -1 | 1) => void} props.onPeriodChange Переключение периода.
 * @param {() => void} props.onTodayClick Переход к текущей дате.
 * @returns {JSX.Element} JSX календаря.
 */

function Calendar({ 
  currentYear, 
  currentMonth, 
  selectedDay,
  activeDate,
  activitiesMap,
  viewMode,
  weekActivities,
  listActivities,
  periodLabel,
  onDateSelect,
  onPeriodChange,
  onTodayClick 
}) {
  const calendarData = getCalendarData(currentYear, currentMonth);
  
  // Создаём массив дней для отображения
  const days = [];
  
  // Пустые ячейки до начала месяца
  for (let i = 0; i < calendarData.startDayOfWeek; i++) {
    days.push(null);
  }
  
  // Дни месяца
  for (let day = 1; day <= calendarData.daysInMonth; day++) {
    days.push(day);
  }

  const renderMonthView = () => (
    <>
      <div className="weekdays">
        {WEEKDAYS.map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map((day, index) => (
          <CalendarDay
            key={index}
            day={day}
            isToday={day && isToday(currentYear, currentMonth, day)}
            isSelected={day === selectedDay}
            hasEvents={day && activitiesMap[day]?.length > 0}
            eventCount={day ? activitiesMap[day]?.length || 0 : 0}
            eventTypes={day ? [...new Set((activitiesMap[day] || []).map((activity) => activity.eventType || 'internal'))] : []}
            onClick={(clickedDay) => onDateSelect(new Date(currentYear, currentMonth, clickedDay))}
          />
        ))}
      </div>
    </>
  );

  const renderWeekView = () => (
    <div className="calendar-week-view">
      {weekActivities.map(({ date, activities }) => {
        const selected = isSameDay(date, activeDate);
        const today = isSameDay(date, new Date());
        const hasEvents = activities.length > 0;
        const eventTypes = [...new Set(activities.map((activity) => activity.eventType || 'internal'))];
        const weekDayLabel = WEEKDAYS[(date.getDay() + 6) % 7];
        const dayStateLabel = selected
          ? 'Выбранный день'
          : today
            ? 'Сегодня'
            : hasEvents
              ? `${activities.length} ${activities.length === 1 ? 'встреча' : 'встречи'}`
              : 'Без встреч';

        return (
          <button
            key={date.toISOString()}
            type="button"
            className={`week-day-card${selected ? ' week-day-card--selected' : ''}${today ? ' week-day-card--today' : ''}${hasEvents ? ' week-day-card--busy' : ' week-day-card--quiet'}`}
            onClick={() => onDateSelect(date)}
          >
            <div className="week-day-card__top">
              <div className="week-day-card__calendar">
                <span className="week-day-card__weekday">{weekDayLabel}</span>
                <span className="week-day-card__date">{date.getDate()}</span>
              </div>
              <span className="week-day-card__state">{dayStateLabel}</span>
            </div>
            <div className="week-day-card__count">
              {hasEvents ? `${activities.length} в публичной программе` : 'Свободное окно'}
            </div>
            <div className="week-day-card__indicators">
              {eventTypes.includes('internal') && <span className="day-indicator day-indicator--internal"></span>}
              {eventTypes.includes('external') && <span className="day-indicator day-indicator--external"></span>}
            </div>
            <div className="week-day-card__preview">
              {hasEvents
                ? activities.slice(0, selected ? 4 : 2).map((activity) => (
                    <span key={activity.id} className="week-day-card__preview-item">
                      {getActivityPreview(activity)}
                    </span>
                  ))
                : <span className="week-day-card__preview-empty">Нет публичных встреч</span>}
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="agenda-list">
      {listActivities.length === 0 ? (
        <div className="no-activities">В этом месяце по текущим фильтрам активностей нет</div>
      ) : (
        listActivities.map((activity) => {
          const activityDate = parseDate(activity.date);
          const selected = isSameDay(activityDate, activeDate);

          return (
            <button
              key={activity.id}
              type="button"
              className={`agenda-item${selected ? ' agenda-item--selected' : ''}`}
              onClick={() => activityDate && onDateSelect(activityDate)}
            >
              <span className="agenda-item__date">{activity.date}</span>
              <span className="agenda-item__time">{activity.time || 'Без времени'}</span>
              <span className="agenda-item__title">{activity.person || activity.name || 'Активность'}</span>
              {activity.objects && (
                <span className="agenda-item__object">{activity.objects}</span>
              )}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="calendar-section">
      <div className="header">
        <div className="month-navigation">
          <h2>{periodLabel}</h2>
          <div className="nav-buttons">
            <button className="btn" onClick={() => onPeriodChange(-1)}>
              ← Пред
            </button>
            <button className="btn btn-today" onClick={onTodayClick}>
              Сегодня
            </button>
            <button className="btn" onClick={() => onPeriodChange(1)}>
              След →
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-wrapper">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'list' && renderListView()}
      </div>
    </div>
  );
}

export default Calendar;