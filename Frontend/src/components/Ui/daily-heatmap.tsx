
import { useMemo, useState } from "react";
import {
  type HourlyHeatCell,
  formatMinutes,
  localDayKey,
} from "./analytics-data";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const shortDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

// Display hours as 01:00–24:00
const hourLabel = (hour: number) =>
  `${String(hour + 1).padStart(2, "0")}:00`;

function cellBackground(minutes: number, max: number) {
  if (minutes <= 0) return "var(--color-surface)";

  const pct = Math.round(20 + (minutes / max) * 80);

  return `color-mix(in oklab, var(--color-primary) ${pct}%, var(--color-surface))`;
}

export function DailyHeatmap({
  cells,
  generatedAt,
}: {
  cells?: HourlyHeatCell[];
  generatedAt: number;
}) {
  const [active, setActive] = useState<string | null>(null);

  const { rows, max, totalMinutes, activeHours } = useMemo(() => {
    const now = new Date(generatedAt);

    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    monday.setDate(
      monday.getDate() - ((monday.getDay() + 6) % 7),
    );

    const minutesByHour = new Map(
      (cells ?? []).map((cell) => [
        `${cell.date}/${cell.hour}`,
        cell.minutes,
      ]),
    );

    const rows = DAYS.map((label, index) => {
      const date = new Date(monday);

      date.setDate(date.getDate() + index);

      const dateKey = localDayKey(date);

      return {
        label,
        date,
        today: dateKey === localDayKey(now),

        hours: HOURS.map((hour) => {
          const key = `${dateKey}/${hour}`;

          const start = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            hour,
          );

          return {
            key,
            hour,
            future: start.getTime() > now.getTime(),
            minutes: Math.max(
              0,
              minutesByHour.get(key) ?? 0,
            ),
          };
        }),
      };
    });

    const pastHours = rows
      .flatMap((row) => row.hours)
      .filter((slot) => !slot.future);

    return {
      rows,
      max: Math.max(
        1,
        ...pastHours.map((slot) => slot.minutes),
      ),
      totalMinutes: pastHours.reduce(
        (sum, slot) => sum + slot.minutes,
        0,
      ),
      activeHours: pastHours.filter(
        (slot) => slot.minutes > 0,
      ).length,
    };
  }, [cells, generatedAt]);

  const activeRow = rows.find((row) =>
    row.hours.some((slot) => slot.key === active),
  );

  const activeSlot = activeRow?.hours.find(
    (slot) => slot.key === active,
  );

  return (
    <section
      className="flex h-full min-h-0 flex-col border border-soft p-6 animate-fadeIn"
      aria-labelledby="daily-heatmap-title"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="daily-heatmap-title"
            className="text-heading-5 text-primary"
          >
            Daily heatmap
          </h3>

          <p
            className="mt-1 text-body-sm text-steel !font-inter !font-semibold tabular-nums"
            aria-live="polite"
          >
            {cells === undefined
              ? "Hourly focus data is not available yet."
              : activeSlot && activeRow
                ? `${activeRow.label} · ${hourLabel(activeSlot.hour)}–${hourLabel(activeSlot.hour + 1)} · ${formatMinutes(activeSlot.minutes)}`
                : `${activeHours} active ${activeHours === 1 ? "hour" : "hours"} · ${formatMinutes(totalMinutes)} this week`}
          </p>
        </div>

        <div
          className="flex items-center gap-1.5 text-caption text-stone"
          aria-hidden="true"
        >
          <span>Less</span>

          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <span
              key={step}
              className="size-3"
              style={{
                background: cellBackground(step * max, max),
              }}
            />
          ))}

          <span>More</span>
        </div>
      </div>

      {cells === undefined ? (
        <p className="mt-6 text-body-sm text-steel">
          Refresh after the analytics service is updated to see focus time by
          hour.
        </p>
      ) : (
        <div
          className="mt-5 flex min-h-0 flex-1 items-center overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary"
          role="region"
          aria-label="Scrollable hourly focus heatmap"
          tabIndex={0}
        >
          <table
            className="w-full min-w-[760px] table-fixed border-separate [border-spacing:4px]"
            onMouseLeave={() => setActive(null)}
          >
            <caption className="sr-only">
              Focus minutes by hour for each day of the current week.
              Dashed boxes indicate future hours.
            </caption>

            <colgroup>
              <col className="w-16" />

              {HOURS.map((hour) => (
                <col key={hour} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Day / hour</span>
                </th>

                {HOURS.map((hour) => (
                  <th
                    key={hour}
                    scope="col"
                    className={`pb-1 text-center text-micro font-normal !font-inter tabular-nums ${
                      activeSlot?.hour === hour
                        ? "text-primary"
                        : "text-stone"
                    }`}
                  >
                    {String(hour + 1).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={localDayKey(row.date)}>
                  <th
                    scope="row"
                    className={`pr-1 text-left text-micro !font-inter ${
                      row.today || activeRow === row
                        ? "font-semibold text-primary"
                        : "font-normal text-stone"
                    }`}
                  >
                    {row.label}
                  </th>

                  {row.hours.map((slot) => (
                    <td key={slot.key} className="p-0">
                      {slot.future ? (
                        <span
                          className="block h-[clamp(24px,2.2vw,28px)] border border-dashed border-soft"
                          title={`${row.label}, ${shortDate(row.date)}, ${hourLabel(slot.hour)}: future hour`}
                          aria-label={`${row.label}, ${shortDate(row.date)}, ${hourLabel(slot.hour)}: future hour`}
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={`${row.label}, ${shortDate(row.date)}, ${hourLabel(slot.hour)}–${hourLabel(slot.hour + 1)}: ${formatMinutes(slot.minutes)}`}
                          title={`${hourLabel(slot.hour)}–${hourLabel(slot.hour + 1)} · ${formatMinutes(slot.minutes)}`}
                          className={`block h-[clamp(24px,2.2vw,28px)] w-full outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                            active === slot.key
                              ? "scale-110 ring-2 ring-[var(--color-primary)]"
                              : ""
                          }`}
                          style={{
                            background: cellBackground(
                              slot.minutes,
                              max,
                            ),
                          }}
                          onMouseEnter={() => setActive(slot.key)}
                          onFocus={() => setActive(slot.key)}
                          onBlur={() => setActive(null)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
