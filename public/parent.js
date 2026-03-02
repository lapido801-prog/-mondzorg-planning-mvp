import { t } from "./i18n.js";

const dom = {
  lang: document.getElementById("lang"),
  locationFilter: document.getElementById("locationFilter"),
  loadDaysBtn: document.getElementById("loadDaysBtn"),
  serviceDate: document.getElementById("serviceDate"),
  bookingForm: document.getElementById("bookingForm"),
  status: document.getElementById("status"),
  parentName: document.getElementById("parentName"),
  parentEmail: document.getElementById("parentEmail"),
  parentPhone: document.getElementById("parentPhone"),
  childName: document.getElementById("childName"),
  childDob: document.getElementById("childDob"),
  notes: document.getElementById("notes")
};

function getLang() {
  return dom.lang.value || "nl";
}

function setStatus(message, isError = false) {
  dom.status.textContent = message;
  dom.status.className = isError ? "status error" : "status";
}

function applyTranslations() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(getLang(), key);
  });
}

async function loadDays() {
  setStatus("");
  const location = dom.locationFilter.value.trim();
  const response = await fetch(`/api/public/days?location=${encodeURIComponent(location)}`);
  const data = await response.json();

  dom.serviceDate.innerHTML = "";
  if (!response.ok) {
    throw new Error(data.error || "Kon dagen niet laden.");
  }
  if (!data.days.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t(getLang(), "noDays");
    dom.serviceDate.append(option);
    return;
  }

  for (const day of data.days) {
    const option = document.createElement("option");
    option.value = day.serviceDate;
    option.textContent = `${day.serviceDate} (${day.bookedCount}/${day.capacity})`;
    dom.serviceDate.append(option);
  }
}

async function submitBooking(event) {
  event.preventDefault();
  setStatus("");

  const payload = {
    language: getLang(),
    serviceDate: dom.serviceDate.value,
    location: dom.locationFilter.value.trim(),
    parentName: dom.parentName.value.trim(),
    parentEmail: dom.parentEmail.value.trim(),
    parentPhone: dom.parentPhone.value.trim(),
    childName: dom.childName.value.trim(),
    childDob: dom.childDob.value,
    notes: dom.notes.value.trim()
  };

  const response = await fetch("/api/public/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Boeking mislukt.");
  }

  const booking = data.booking;
  const message =
    `${t(getLang(), "successTitle")} | ` +
    `${t(getLang(), "bookingRef")}: ${booking.bookingRef} | ` +
    `${t(getLang(), "appointmentTime")}: ${booking.serviceDate} ${booking.startTime}-${booking.endTime}`;
  setStatus(message);
  dom.bookingForm.reset();
  dom.lang.value = payload.language;
  dom.locationFilter.value = payload.location;
  await loadDays();
}

dom.loadDaysBtn.addEventListener("click", async () => {
  try {
    await loadDays();
  } catch (error) {
    setStatus(String(error.message || error), true);
  }
});

dom.bookingForm.addEventListener("submit", async (event) => {
  try {
    await submitBooking(event);
  } catch (error) {
    setStatus(String(error.message || error), true);
  }
});

dom.lang.addEventListener("change", () => {
  applyTranslations();
});

applyTranslations();
loadDays().catch((error) => setStatus(String(error.message || error), true));
