import CalendarDay from './CalendarDay';
import { MONTHS, WEEKDAYS, getCalendarData, isToday } from '../utils/dateUtils';

function Calendar({ 
  currentYear, 
  currentMonth, 
  selectedDay,
  activitiesMap,
  onDaySelect, 
  onMonthChange, 
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

  return (
    <div className="calendar-section">
      <div className="header">
        <div className="month-navigation">
          <h2>{MONTHS[currentMonth]} {currentYear}</h2>
          <div className="nav-buttons">
            <button className="btn" onClick={() => onMonthChange(-1)}>
              ← Пред
            </button>
            <button className="btn btn-today" onClick={onTodayClick}>
              Сегодня
            </button>
            <button className="btn" onClick={() => onMonthChange(1)}>
              След →
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-wrapper">
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
              eventTypes={day ? [...new Set((activitiesMap[day] || []).map((activity) => activity.eventType || 'internal'))] : []}
              onClick={onDaySelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Calendar;