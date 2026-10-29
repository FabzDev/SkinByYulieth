import { useState } from 'react'
import {
  addDays,
  addMonths,
  currentMonthRange,
  currentWeekRange,
  endOfMonth,
  endOfWeekSunday,
  formatShortDate,
  monthLabel,
  periodLabel,
  startOfMonth,
  startOfWeekMonday,
  todayBogota,
} from '../../shared/dates'
import { Icon } from './Icon'
import { DateField } from './forms'

type Mode = 'month' | 'week' | 'custom'

function detectMode(from: string, to: string): Mode {
  if (from === startOfMonth(from) && to === endOfMonth(from)) return 'month'
  if (from === startOfWeekMonday(from) && to === endOfWeekSunday(from)) return 'week'
  return 'custom'
}

export function PeriodPicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const [mode, setMode] = useState<Mode>(() => detectMode(from, to))

  const setPreset = (nextMode: Mode) => {
    setMode(nextMode)
    if (nextMode === 'month') {
      const range = currentMonthRange()
      onChange(range.from, range.to)
    } else if (nextMode === 'week') {
      const range = currentWeekRange()
      onChange(range.from, range.to)
    }
  }

  const shift = (direction: -1 | 1) => {
    if (mode === 'month') {
      const nextFrom = addMonths(startOfMonth(from), direction)
      onChange(nextFrom, endOfMonth(nextFrom))
    } else if (mode === 'week') {
      const nextFrom = addDays(startOfWeekMonday(from), direction * 7)
      onChange(nextFrom, endOfWeekSunday(nextFrom))
    }
  }

  const label =
    mode === 'month'
      ? monthLabel(from.slice(0, 7))
      : mode === 'week'
        ? `Semana del ${formatShortDate(from)} al ${formatShortDate(to)}`
        : periodLabel(from, to)

  return (
    <div className="period-picker">
      <div className="period-picker__top">
        <div className="segmented segmented--small" role="group" aria-label="Tipo de período">
          <button
            type="button"
            className={mode === 'month' ? 'is-active' : ''}
            onClick={() => setPreset('month')}
          >
            Mes
          </button>
          <button
            type="button"
            className={mode === 'week' ? 'is-active' : ''}
            onClick={() => setPreset('week')}
          >
            Semana
          </button>
          <button
            type="button"
            className={mode === 'custom' ? 'is-active' : ''}
            onClick={() => setMode('custom')}
          >
            Fechas
          </button>
        </div>
        <button
          type="button"
          className="period-picker__today"
          onClick={() => {
            const today = todayBogota()
            if (mode === 'month') {
              const range = currentMonthRange()
              onChange(range.from, range.to)
            } else if (mode === 'week') {
              const range = currentWeekRange()
              onChange(range.from, range.to)
            } else {
              onChange(today, today)
            }
          }}
        >
          Hoy
        </button>
      </div>

      <div className="period-picker__nav">
        <button
          type="button"
          className="icon-button"
          onClick={() => shift(-1)}
          disabled={mode === 'custom'}
          aria-label="Período anterior"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <span className="period-picker__label">{label}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => shift(1)}
          disabled={mode === 'custom'}
          aria-label="Período siguiente"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {mode === 'custom' ? (
        <div className="period-picker__dates">
          <DateField
            value={from}
            max={to}
            onChange={(value) => onChange(value, value > to ? value : to)}
          />
          <span>hasta</span>
          <DateField
            value={to}
            min={from}
            onChange={(value) => onChange(value < from ? value : from, value)}
          />
        </div>
      ) : null}
    </div>
  )
}
