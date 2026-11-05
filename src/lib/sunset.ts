/**
 * Sunset in Ethiopia and the Ustaz's attendance reminder time.
 *
 * The reminder fires an hour and a half before sunset (Ethiopian time, Africa/Addis_Ababa
 * unless the school has its own timezone). Sunset moves through the year (about
 * 17:45 in November to 18:40 in July), so the time is computed per day with the
 * standard NOAA/Almanac sunrise-equation instead of being a fixed clock time.
 * Accurate to about a minute, which is plenty for a reminder.
 *
 * Pure (no React, no Firebase), shared by the app and the server cron.
 */

export const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa'

/** Addis Ababa: used for every medreseh (the whole country sets sunset within ~20 minutes). */
export const DEFAULT_COORDINATES = { latitude: 9.03, longitude: 38.74 }

/** The reminder goes out this long before sunset (an hour and a half). */
export const REMINDER_BEFORE_SUNSET_MINUTES = 90

/** Used only if the sunset cannot be computed. */
export const FALLBACK_REMINDER_TIME = '16:45'

const RAD = Math.PI / 180

/** Official zenith for sunset: the sun's centre 90.833° from straight up (refraction + disc radius). */
const ZENITH = 90.833

function dayOfYear(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000)
}

/** Degrees into [0, 360). */
const norm360 = (deg: number) => ((deg % 360) + 360) % 360

/**
 * The moment the sun sets on a calendar day (YYYY-MM-DD) at the given place,
 * or null when it does not set that day (polar regions; never in Ethiopia).
 */
export function sunsetAt(
  date: string,
  { latitude, longitude }: { latitude: number; longitude: number } = DEFAULT_COORDINATES
): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]

  const lngHour = longitude / 15
  const t = dayOfYear(year, month, day) + (18 - lngHour) / 24
  const meanAnomaly = 0.9856 * t - 3.289
  const trueLongitude = norm360(
    meanAnomaly + 1.916 * Math.sin(meanAnomaly * RAD) + 0.02 * Math.sin(2 * meanAnomaly * RAD) + 282.634
  )

  let rightAscension = norm360(Math.atan(0.91764 * Math.tan(trueLongitude * RAD)) / RAD)
  // Same quadrant as the true longitude.
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90
  rightAscension /= 15

  const sinDec = 0.39782 * Math.sin(trueLongitude * RAD)
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosHour = (Math.cos(ZENITH * RAD) - sinDec * Math.sin(latitude * RAD)) / (cosDec * Math.cos(latitude * RAD))
  if (cosHour > 1 || cosHour < -1) return null

  const hourAngle = Math.acos(cosHour) / RAD / 15
  const localMeanTime = hourAngle + rightAscension - 0.06571 * t - 6.622
  const utcHours = (((localMeanTime - lngHour) % 24) + 24) % 24

  return new Date(Date.UTC(year, month - 1, day) + Math.round(utcHours * 3_600_000))
}

/** The clock in a timezone: calendar day (YYYY-MM-DD), time (HH:MM, 24h) and weekday (0 = Sunday). */
export function zonedClock(now: Date, timeZone: string = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const [y, mo, d] = [Number(get('year')), Number(get('month')), Number(get('day'))]
  return { date, time: `${get('hour')}:${get('minute')}`, weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() }
}

/** HH:MM of an instant on a timezone's wall clock. */
export function clockTime(at: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return zonedClock(at, timeZone).time
}

/** The instant the Ustaz is reminded on a day: an hour and a half before sunset. */
export function reminderInstant(date: string): Date | null {
  const sunset = sunsetAt(date)
  if (!sunset) return null
  return new Date(sunset.getTime() - REMINDER_BEFORE_SUNSET_MINUTES * 60_000)
}

/** The Ustaz reminder as a wall-clock HH:MM in the school's timezone (e.g. "16:52"). */
export function teacherReminderTime(date: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const at = reminderInstant(date)
  return at ? clockTime(at, timeZone) : FALLBACK_REMINDER_TIME
}

/** True once the reminder time of the school's current day has been reached. */
export function isTeacherReminderDue(now: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): boolean {
  const { date, time } = zonedClock(now, timeZone)
  return time >= teacherReminderTime(date, timeZone)
}
