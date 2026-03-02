export const START_HOUR = 15;
export const SLOT_MINUTES = 30;

function toTime(minutesFromMidnight) {
  const hours = Math.floor(minutesFromMidnight / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minutesFromMidnight % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function slotWindow(slotIndex) {
  const startMinutes = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  return {
    startTime: toTime(startMinutes),
    endTime: toTime(startMinutes + SLOT_MINUTES)
  };
}

export function computeNextSlot(takenSlots, capacity) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capaciteit moet een positief geheel getal zijn.");
  }

  const normalized = new Set(
    takenSlots
      .filter((v) => Number.isInteger(v) && v >= 0 && v < capacity)
      .sort((a, b) => a - b)
  );

  for (let slot = 0; slot < capacity; slot += 1) {
    if (!normalized.has(slot)) {
      return slot;
    }
  }
  return null;
}
