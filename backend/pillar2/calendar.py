"""Joint fertilizer + irrigation calendar builder for Pillar 2."""
from __future__ import annotations

from datetime import date, datetime, timedelta


def build_joint_calendar(
    split_schedule: list[dict],
    irrigation_schedule: dict | None,
    planting_date: str | None,
    stage_days: int = 0,
) -> list[dict]:
    """Merge adapted fertilizer split schedule and 7-day irrigation into one calendar.

    Agronomic rules applied:
    - Basal (Day 0): always shown regardless of weather.
    - Urea top-dressing: warn if no irrigation within ±2 days of the forecast window.
    - Heavy rain day (>15mm): shift Urea application by 1 day and note why.

    Args:
        split_schedule:      Adapted split schedule from products.adapt_split_schedule().
        irrigation_schedule: Result from irrigation.build_irrigation_schedule(), or None.
        planting_date:       ISO date string (YYYY-MM-DD) for date labels, or None.
        stage_days:          Current crop stage in days (to offset fertilizer days).

    Returns:
        List of event dicts sorted by day.
    """
    planting = None
    if planting_date:
        try:
            planting = date.fromisoformat(planting_date)
        except ValueError:
            planting = None

    # Gather irrigation actions keyed by relative day-index (0=today, 1=tomorrow, ...)
    irr_by_day: dict[int, dict] = {}
    if irrigation_schedule:
        for idx, irr in enumerate(irrigation_schedule.get("weekly_schedule", [])):
            irr_by_day[idx] = irr

    # Days from today with heavy rain (>15mm)
    heavy_rain_days: set[int] = {
        idx for idx, d in irr_by_day.items() if d.get("rainfall_mm", 0) > 15.0
    }

    # Days from today with irrigation
    irrigate_days: set[int] = {
        idx for idx, d in irr_by_day.items() if d.get("action") == "irrigate"
    }

    events: list[dict] = []

    # --- Fertilizer events (relative to planting, projected forward) ---
    for split in split_schedule:
        fert_day = split["day"]
        # relative to today: how many days from now is this event?
        relative = fert_day - stage_days

        shifted = False
        shift_note = None

        # Check for heavy rain on the scheduled day
        if relative in heavy_rain_days and split.get("urea_bags", 0) > 0:
            relative += 1
            shifted = True
            shift_note = "Urea shifted 1 day — heavy rain on original date"

        # Check Urea proximity to irrigation
        urea_warning = None
        if split.get("urea_bags", 0) > 0 and relative > 0:
            nearby_irr = any(
                abs(relative - irr_day) <= 2 for irr_day in irrigate_days
            )
            if not nearby_irr and irr_by_day:  # only warn if we have forecast data
                urea_warning = "Irrigate before applying Urea to prevent nitrogen loss"

        cal_date: str | None = None
        if planting:
            event_date = planting + timedelta(days=fert_day if not shifted else fert_day + 1)
            cal_date = event_date.isoformat()

        note_parts = []
        if shift_note:
            note_parts.append(shift_note)
        if urea_warning:
            note_parts.append(urea_warning)

        events.append({
            "day":                   fert_day,
            "date":                  cal_date,
            "type":                  "fertilizer",
            "actions":               [f"Apply {split['stage']}"] + split.get("products", []),
            "products":              split.get("products", []),
            "irrigation_duration_min": None,
            "note":                  " | ".join(note_parts) if note_parts else None,
            "urgency":               "high" if fert_day == 0 else "normal",
            "stage_ta":              split.get("stage_ta", ""),
        })

    # --- Irrigation events from 7-day forecast ---
    if irrigation_schedule:
        for idx, irr in irr_by_day.items():
            irr_day = stage_days + idx

            cal_date = None
            if planting:
                cal_date = (planting + timedelta(days=irr_day)).isoformat()

            action_label = {
                "irrigate":          f"💧 Irrigate" + (f" {int(irr['duration_min'])} min" if irr.get("duration_min") else " (advisory)"),
                "skip_rain":         f"🌧️ Skip — rain {irr.get('rainfall_mm', 0)}mm",
                "skip_sufficient":   "✅ Skip — soil moisture sufficient",
                "advisory":          f"ℹ️ {irr.get('note', 'Advisory')}",
            }.get(irr["action"], irr["action"])

            events.append({
                "day":                   irr_day,
                "date":                  cal_date,
                "type":                  "irrigation",
                "actions":               [action_label],
                "products":              [],
                "irrigation_duration_min": irr.get("duration_min"),
                "note":                  irr.get("note"),
                "urgency":               "normal" if irr["action"] == "irrigate" else "low",
                "irr_action":            irr["action"],
                "rainfall_mm":           irr.get("rainfall_mm", 0),
            })

    # Merge same-day events
    merged: dict[int, dict] = {}
    for ev in events:
        d = ev["day"]
        if d not in merged:
            merged[d] = dict(ev)
        else:
            existing = merged[d]
            # Combine types
            existing_type = existing["type"]
            if existing_type != ev["type"]:
                existing["type"] = "both"
            existing["actions"] = existing["actions"] + ev["actions"]
            existing["products"] = existing["products"] + ev["products"]
            if ev.get("irrigation_duration_min"):
                existing["irrigation_duration_min"] = ev["irrigation_duration_min"]
            if ev.get("note"):
                existing["note"] = (
                    f"{existing['note']} | {ev['note']}"
                    if existing.get("note")
                    else ev["note"]
                )

    return sorted(merged.values(), key=lambda x: x["day"])
