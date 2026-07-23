import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/components/interactive-charts.css";

const FILTER_GROUPS = [
  {
    label: "Theo ngày",
    items: [
      ["today", "Hôm nay"],
      ["yesterday", "Hôm qua"],
      ["last7Days", "7 ngày qua"],
      ["last30Days", "30 ngày qua"],
    ],
  },
  {
    label: "Theo tháng",
    items: [
      ["thisMonth", "Tháng này"],
      ["lastMonth", "Tháng trước"],
      ["customMonth", "Chọn tháng"],
    ],
  },
  {
    label: "Theo năm",
    items: [
      ["thisYear", "Năm nay"],
      ["year", "Chọn năm"],
    ],
  },
];

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateString(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatShortDate(value) {
  if (!value) return "";
  return fromDateString(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function filterLabel(value = {}) {
  const labels = Object.fromEntries(FILTER_GROUPS.flatMap((group) => group.items));
  if (value.filterType === "custom") {
    return `${formatShortDate(value.startDate)} – ${formatShortDate(value.endDate)}`;
  }
  if (value.filterType === "customMonth" && value.month) {
    const [year, month] = value.month.split("-");
    return `Tháng ${Number(month)}/${year}`;
  }
  if (value.filterType === "year" && value.year) return `Năm ${value.year}`;
  return labels[value.filterType] || "30 ngày qua";
}

function CalendarGrid({ cursor, startDate, endDate, onSelect }) {
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const firstCell = new Date(first);
    firstCell.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCell);
      date.setDate(firstCell.getDate() + index);
      return date;
    });
  }, [cursor]);

  return (
    <div className="chart-filter-calendar" role="grid" aria-label="Chọn khoảng ngày">
      {WEEKDAYS.map((day) => (
        <span className="chart-filter-weekday" key={day} role="columnheader">{day}</span>
      ))}
      {cells.map((date) => {
        const dateString = toDateString(date);
        const isOutside = date.getMonth() !== cursor.getMonth();
        const isStart = dateString === startDate;
        const isEnd = dateString === endDate;
        const isInRange = startDate && endDate && dateString > startDate && dateString < endDate;
        return (
          <button
            className={`chart-filter-day${isOutside ? " is-outside" : ""}${isInRange ? " is-in-range" : ""}${isStart || isEnd ? " is-selected" : ""}`}
            key={dateString}
            type="button"
            onClick={() => onSelect(dateString)}
            aria-pressed={Boolean(isStart || isEnd)}
          >
            {date.getDate()}
          </button>
        );
      })}
    </div>
  );
}

export default function ChartTimeFilter({ value, onChange, disabled = false, scopeLabel = "Cập nhật tất cả biểu đồ trên trang" }) {
  const triggerRef = useRef(null);
  const rootRef = useRef(null);
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("presets");
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [yearValue, setYearValue] = useState(now.getFullYear());
  const [calendarCursor, setCalendarCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const closeFilter = useCallback(() => {
    setOpen(false);
    setMode("presets");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) closeFilter();
    }
    function onKeyDown(event) {
      if (event.key === "Escape") closeFilter();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeFilter, open]);

  function commit(nextValue) {
    onChange(nextValue);
    closeFilter();
  }

  function choosePreset(filterType) {
    if (filterType === "customMonth") {
      setMode("month");
      return;
    }
    if (filterType === "year") {
      setMode("year");
      return;
    }
    commit({ filterType });
  }

  function chooseRangeDate(dateString) {
    if (!rangeStart || rangeEnd || dateString < rangeStart) {
      setRangeStart(dateString);
      setRangeEnd("");
      return;
    }
    setRangeEnd(dateString);
  }

  return (
    <div className="chart-time-filter" ref={rootRef}>
      <button
        ref={triggerRef}
        className="chart-filter-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
      >
        <span aria-hidden="true">◷</span>
        <span>{filterLabel(value)}</span>
        <span className="chart-filter-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="chart-filter-popover" role="dialog" aria-label="Bộ lọc thời gian biểu đồ">
          {mode === "presets" && (
            <>
              <div className="chart-filter-popover-heading">
                <div>
                  <strong>Khoảng thời gian</strong>
                  <span>{scopeLabel}</span>
                </div>
                <button className="chart-filter-close" type="button" onClick={closeFilter} aria-label="Đóng bộ lọc">×</button>
              </div>
              {FILTER_GROUPS.map((group) => (
                <div className="chart-filter-group" key={group.label}>
                  <span className="chart-filter-group-label">{group.label}</span>
                  <div className="chart-filter-options">
                    {group.items.map(([filterType, label]) => (
                      <button
                        type="button"
                        key={filterType}
                        className={value?.filterType === filterType ? "is-active" : ""}
                        onClick={() => choosePreset(filterType)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button className="chart-filter-custom-range" type="button" onClick={() => setMode("range")}>
                <span><strong>Tùy chọn khoảng ngày</strong><small>Chọn ngày bắt đầu và kết thúc</small></span>
                <span aria-hidden="true">→</span>
              </button>
            </>
          )}

          {mode === "month" && (
            <>
              <div className="chart-filter-view-header">
                <button type="button" onClick={() => setMode("presets")} aria-label="Quay lại">←</button>
                <strong>Chọn tháng</strong>
                <span />
              </div>
              <div className="chart-filter-year-nav">
                <button type="button" onClick={() => setMonthYear((year) => year - 1)} aria-label="Năm trước">‹</button>
                <strong>{monthYear}</strong>
                <button type="button" onClick={() => setMonthYear((year) => year + 1)} aria-label="Năm sau">›</button>
              </div>
              <div className="chart-filter-month-grid">
                {MONTHS.map((month, index) => (
                  <button
                    type="button"
                    key={month}
                    onClick={() => commit({ filterType: "customMonth", month: `${monthYear}-${pad(index + 1)}` })}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === "year" && (
            <>
              <div className="chart-filter-view-header">
                <button type="button" onClick={() => setMode("presets")} aria-label="Quay lại">←</button>
                <strong>Chọn năm</strong>
                <span />
              </div>
              <div className="chart-filter-year-picker">
                <button type="button" onClick={() => setYearValue((year) => year - 1)} aria-label="Năm trước">−</button>
                <strong>{yearValue}</strong>
                <button type="button" onClick={() => setYearValue((year) => year + 1)} aria-label="Năm sau">+</button>
              </div>
              <button className="chart-filter-apply" type="button" onClick={() => commit({ filterType: "year", year: String(yearValue) })}>
                Áp dụng năm {yearValue}
              </button>
            </>
          )}

          {mode === "range" && (
            <>
              <div className="chart-filter-view-header">
                <button type="button" onClick={() => setMode("presets")} aria-label="Quay lại">←</button>
                <strong>Khoảng ngày tùy chọn</strong>
                <span />
              </div>
              <div className="chart-filter-range-summary" aria-live="polite">
                <span><small>Từ ngày</small><strong>{formatShortDate(rangeStart) || "Chưa chọn"}</strong></span>
                <span aria-hidden="true">→</span>
                <span><small>Đến ngày</small><strong>{formatShortDate(rangeEnd) || "Chưa chọn"}</strong></span>
              </div>
              <div className="chart-filter-calendar-nav">
                <button type="button" onClick={() => setCalendarCursor((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} aria-label="Tháng trước">‹</button>
                <strong>{calendarCursor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</strong>
                <button type="button" onClick={() => setCalendarCursor((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} aria-label="Tháng sau">›</button>
              </div>
              <CalendarGrid cursor={calendarCursor} startDate={rangeStart} endDate={rangeEnd} onSelect={chooseRangeDate} />
              <button
                className="chart-filter-apply"
                type="button"
                disabled={!rangeStart || !rangeEnd}
                onClick={() => commit({ filterType: "custom", startDate: rangeStart, endDate: rangeEnd })}
              >
                Áp dụng khoảng ngày
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
