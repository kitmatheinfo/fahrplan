import React, { useEffect, useState, useRef } from 'react'
import type { Event } from '../utils/ical'
import { isSameDay, formatTime } from '../utils/date'
import Modal from './Modal'
import EventDisplay from './EventDisplay'

const HEIGHT_PER_HOUR = 48
const MARGIN_EVENTS = 2

const COLORS_PER_PRIORITY: Record<number, string> = {
  1: 'bg-blue-400',
  2: 'bg-blue-300'
}

const useTime = (refreshTime = 1000): [Date, true] | [undefined, false] => {
  const [time, setTime] = useState<{ ready: false; time: undefined } | { ready: true; time: Date }>({
    ready: false,
    time: undefined
  })
  const interval = useRef<number | undefined>(undefined)

  useEffect(() => {
    setTime({ ready: true, time: new Date() })

    interval.current = setInterval(() => {
      setTime({ ready: true, time: new Date() })
    }, refreshTime) as unknown as number

    return () => {
      clearInterval(interval.current)
    }
  }, [refreshTime, setTime])

  return [time.time, time.ready] as [Date, true] | [undefined, false]
}

/**
 * The starting position is calculated by the difference between the starting time and the start of the event
 */
const calculateStartingPositionFromDate = (startingTime: Date, date: Date) => {
  const hoursFromStart = date.getHours() - startingTime.getHours() + date.getMinutes() / 60 + 0.5

  return hoursFromStart * HEIGHT_PER_HOUR
}

const calculateDurationFromDate = (start: Date, end: Date) =>
  (end.getHours() || 24) - start.getHours() + (end.getMinutes() - start.getMinutes()) / 60

/**
 * The height of an event is calculated by its length and the height of an hour
 */
const calculateHeightFromDate = (start: Date, end: Date) => calculateDurationFromDate(start, end) * HEIGHT_PER_HOUR

/**
 * this takes the earliest hour and rounds it down (meaning 9:30 becomes 9:00)
 * as well as the latest hour and rounds it up (meaning 22:30 becomes 23:00)
 * it will treat 00:00 on the next day as being 24:00 on the current day
 */
const calculateHoursFromEvents = (events: Event[]): Date[] => {
  const startingHours = events.map((event) => event.start.getHours() + event.start.getMinutes() / 60)
  const endingHours = events.map((event) => event.end.getHours() + event.end.getMinutes() / 60)

  let earliest = Math.floor(Math.min(...startingHours))
  let latest = Math.ceil(Math.max(...endingHours))

  // search for event spanning multiple days and in that case:
  // - if ends at 00:00 assume it ends at 24:00
  // - if ends at some other time take the whole 24 hours regardless
  const spanningEvent = events.find((event) => event.start.getDate() !== event.end.getDate())

  if (spanningEvent && spanningEvent.end.getHours() === 0 && spanningEvent.end.getMinutes() === 0) {
    // take until 24:00
    latest = 24
  } else if (spanningEvent) {
    // take full 24:00
    earliest = 0
    latest = 24
  }

  return Array.from(
    { length: latest - earliest + 1 },
    (_, i) => new Date(`2022-10-01T${(earliest + i).toString().padStart(2, '0')}:00:00`)
  ) // TODO: current date for this thing?
}

type CalendarProps = {
  /**
   * the current date
   */
  date: Date
  /**
   * list of all calendar events
   * (later filtered by date)
   */
  events: Event[]
}

const Calendar = ({ events, date }: CalendarProps) => {
  const hours = calculateHoursFromEvents(events)
  const startingTime = hours[0]
  const currentEvents = events.filter(
    (event) =>
      isSameDay(event.start, date) ||
      (isSameDay(event.end, date) && event.end.getHours() !== 0 && event.end.getMinutes() !== 0)
  )
  const [time, ready] = useTime()

  // TODO: better styles for overlapping events
  return (
    <div className="relative flex w-full overflow-y-scroll" style={{ height: 'calc(100vh - 140px)' }}>
      {ready ? (
        <div
          className={`z-1 absolute h-1 w-full ${isSameDay(date, time) ? 'bg-red-400' : 'bg-gray-200'}`}
          style={{ top: calculateStartingPositionFromDate(startingTime, time) - 2 }}
        ></div>
      ) : null}
      <div className="h-fit w-14">
        {hours.map((hour) => (
          <div
            key={hour.toISOString()}
            className="z-2 relative flex items-center justify-end text-right text-sm font-medium"
            style={{ height: HEIGHT_PER_HOUR }}
          >
            <div className="mx-1 bg-white px-1">{formatTime(hour)}</div>
          </div>
        ))}
      </div>
      <div className="relative grow">
        {currentEvents.map((event) => (
          <Modal
            key={event.uuid}
            title={event.title}
            trigger={
              <div
                data-priority={event.priority}
                className={`absolute rounded-lg px-2 py-1 drop-shadow-md ${COLORS_PER_PRIORITY[event.priority]}`}
                style={{
                  left: 16 * (event.priority - 1),
                  width: `calc(100% - ${8 * (event.priority - 1)}px)`,
                  top: calculateStartingPositionFromDate(startingTime, event.start) + MARGIN_EVENTS,
                  height: calculateHeightFromDate(event.start, event.end) - 2 * MARGIN_EVENTS
                }}
              >
                <div className="truncate text-sm text-white">{event.title}</div>
                <div className="text-xs text-white">{`${formatTime(event.start)} - ${formatTime(event.end)}`}</div>
                {calculateDurationFromDate(event.start, event.end) > 1 ? (
                  <div className="truncate text-xs text-white">{event.short_location}</div>
                ) : null}
              </div>
            }
          >
            <EventDisplay event={event} />
          </Modal>
        ))}
      </div>
      <div className="h-fit w-14">
        {ready ? (
          <div
            className={`z-1 absolute ml-2 bg-white px-1 text-sm ${
              isSameDay(date, time) ? 'text-red-400' : 'text-gray-200'
            }`}
            style={{ top: calculateStartingPositionFromDate(startingTime, time) - 10 }}
          >
            {formatTime(time)}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Calendar
