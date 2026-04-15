import { ChevronLeft, ChevronRight, Clock3, FileText, Sparkles, TriangleAlert } from 'lucide-react';
import { getActivityAudienceLabel, isPrivateActivity } from '../auth/accessPolicy';

/**
 * Боковая панель быстрого фокуса для личного кабинета.
 * Вынесена в отдельный слой, чтобы не дублировать основное содержимое кабинета,
 * а давать быстрый доступ к черновикам, ближайшим событиям и проблемам в данных.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen Открыта ли панель.
 * @param {() => void} props.onToggle Переключение открытия/закрытия.
 * @param {import('../services/activitiesApi').Activity[]} props.draftActivities Активности с черновиками отчета.
 * @param {import('../services/activitiesApi').Activity[]} props.upcomingActivities Ближайшие активности на сегодня и завтра.
 * @param {import('../services/activitiesApi').Activity[]} props.incompleteActivities Активности с незаполненными обязательными полями.
 * @param {(activity: import('../services/activitiesApi').Activity) => void} props.onReportClick Открытие окна отчета.
 * @param {(date: string) => void} props.onFocusDate Фильтрация кабинета по дате активности.
 * @returns {JSX.Element}
 */
function PastEventsPanel({
  isOpen,
  onToggle,
  draftActivities,
  upcomingActivities,
  incompleteActivities,
  onReportClick,
  onFocusDate,
}) {
  const totalFocusItems = draftActivities.length + upcomingActivities.length + incompleteActivities.length;

  function renderSection({ key, title, icon: Icon, items, emptyText, renderAction, renderMeta }) {
    return (
      <section key={key} className="past-panel__section">
        <div className="past-panel__section-header">
          <div className="past-panel__section-title-wrap">
            <span className="past-panel__section-icon"><Icon size={14} aria-hidden="true" /></span>
            <span className="past-panel__section-title">{title}</span>
          </div>
          <span className="cabinet__filter-count past-panel__section-count">{items.length}</span>
        </div>

        <div className="past-panel__list">
          {items.length === 0 ? (
            <div className="no-activities">{emptyText}</div>
          ) : (
            items.slice(0, 3).map((activity) => (
              <div key={activity.id} className="past-panel__item">
                <div className="past-panel__item-date">{activity.date}</div>
                <div className="past-panel__item-name">{activity.name || 'Без названия'}</div>
                {renderMeta(activity)}
                <div className="past-panel__item-footer">
                  <span
                    className={`cabinet-badge cabinet-badge--sm ${
                      isPrivateActivity(activity)
                        ? 'cabinet-badge--private'
                        : 'cabinet-badge--public'
                    }`}
                  >
                    {getActivityAudienceLabel(activity)}
                  </span>
                  {renderAction(activity)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      {isOpen && (
        <div className="past-panel__backdrop" onClick={onToggle} />
      )}

      <div className={`past-panel${isOpen ? ' past-panel--open' : ''}`}>
        <div className="past-panel__inner">
          {/* Ручка всегда торчит справа от панели */}
          <button
            className="past-panel__handle"
            onClick={onToggle}
            title={isOpen ? 'Свернуть' : 'Фокус'}
          >
            <span className="past-panel__handle-arrow">
              {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </span>
            <span className="past-panel__handle-label">Фокус</span>
            {totalFocusItems > 0 && (
              <span className="past-panel__handle-count">{totalFocusItems}</span>
            )}
          </button>

          {/* Содержимое панели */}
          <div className="past-panel__header">
            <h4 className="past-panel__title">Быстрый фокус</h4>
            <span className="cabinet__filter-count past-panel__total">
              {totalFocusItems}
            </span>
          </div>

          <div className="past-panel__body">
            <div className="past-panel__intro">
              Панель быстрых действий: продолжайте черновики, открывайте ближайшие дни и проверяйте проблемы в карточках без поиска по кабинету.
            </div>

            {renderSection({
              key: 'drafts',
              title: 'Черновики отчётов',
              icon: FileText,
              items: draftActivities,
              emptyText: 'Черновиков пока нет',
              renderMeta: (activity) => (
                <>
                  {activity.time && <div className="past-panel__item-time">{activity.time}</div>}
                  {activity.objects && <div className="past-panel__item-objects">{activity.objects}</div>}
                </>
              ),
              renderAction: (activity) => (
                <button
                  className="past-panel__report-btn"
                  onClick={() => onReportClick(activity)}
                  title="Продолжить черновик"
                >
                  <FileText size={13} aria-hidden="true" />
                  Продолжить
                </button>
              ),
            })}

            {renderSection({
              key: 'upcoming',
              title: 'Сегодня и завтра',
              icon: Clock3,
              items: upcomingActivities,
              emptyText: 'Ближайших мероприятий нет',
              renderMeta: (activity) => (
                <>
                  {activity.time && <div className="past-panel__item-time">{activity.time}</div>}
                  {(activity.person || activity.objects) && (
                    <div className="past-panel__item-objects">{activity.person || activity.objects}</div>
                  )}
                </>
              ),
              renderAction: (activity) => (
                <button
                  className="past-panel__report-btn"
                  onClick={() => onFocusDate(activity.date)}
                  title="Показать день"
                >
                  <Sparkles size={13} aria-hidden="true" />
                  К дню
                </button>
              ),
            })}

            {renderSection({
              key: 'incomplete',
              title: 'Пробелы в данных',
              icon: TriangleAlert,
              items: incompleteActivities,
              emptyText: 'По карточкам нет критичных пробелов',
              renderMeta: (activity) => (
                <div className="past-panel__item-objects">
                  Не хватает: {activity.missingFields.join(', ')}
                </div>
              ),
              renderAction: (activity) => (
                <button
                  className="past-panel__report-btn"
                  onClick={() => onFocusDate(activity.date)}
                  title="Показать день"
                >
                  <Sparkles size={13} aria-hidden="true" />
                  Проверить
                </button>
              ),
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default PastEventsPanel;
