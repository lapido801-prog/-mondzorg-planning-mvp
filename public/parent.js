import { t } from "./i18n.js";

const SUPPORTED_LANGS = ["nl", "en", "uk"];

const dom = {
  langSwitch: document.getElementById("langSwitch"),
  langButtons: Array.from(document.querySelectorAll(".lang-btn[data-lang]")),
  locationFilter: document.getElementById("locationFilter"),
  serviceDate: document.getElementById("serviceDate"),
  dayHint: document.getElementById("dayHint"),
  submitBtn: document.getElementById("submitBtn"),
  bookingForm: document.getElementById("bookingForm"),
  status: document.getElementById("status"),
  parentName: document.getElementById("parentName"),
  parentEmail: document.getElementById("parentEmail"),
  parentPhone: document.getElementById("parentPhone"),
  childName: document.getElementById("childName"),
  childDob: document.getElementById("childDob"),
  notes: document.getElementById("notes")
};

let currentLang = SUPPORTED_LANGS.includes(window.localStorage.getItem("lang"))
  ? window.localStorage.getItem("lang")
  : "nl";

function getLang() {
  return currentLang;
}

function setStatus(message, isError = false) {
  dom.status.textContent = message;
  dom.status.className = isError ? "status error" : "status";
}

function setDayHint(message) {
  dom.dayHint.textContent = message;
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    return;
  }
  currentLang = lang;
  window.localStorage.setItem("lang", lang);
  dom.langButtons.forEach((button) => {
    const isActive = button.dataset.lang === lang;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
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
  setDayHint(t(getLang(), "loadingDays"));
  dom.submitBtn.disabled = true;
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
    setDayHint(t(getLang(), "noDaysHelp"));
    return;
  }

  let totalOpenSlots = 0;
  for (const day of data.days) {
    const option = document.createElement("option");
    option.value = day.serviceDate;
    option.textContent = `${day.serviceDate} (${day.bookedCount}/${day.capacity})`;
    dom.serviceDate.append(option);
    totalOpenSlots += day.capacity - day.bookedCount;
  }
  setDayHint(`${t(getLang(), "availableSpots")}: ${totalOpenSlots}`);
  dom.submitBtn.disabled = false;
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
  const chosenLang = getLang();
  dom.bookingForm.reset();
  setLang(chosenLang);
  dom.locationFilter.value = payload.location;
  await loadDays();
}

dom.bookingForm.addEventListener("submit", async (event) => {
  try {
    await submitBooking(event);
  } catch (error) {
    setStatus(String(error.message || error), true);
  }
});

dom.langSwitch.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const nextLang = target.dataset.lang;
  if (!nextLang || nextLang === getLang()) {
    return;
  }
  setLang(nextLang);
  applyTranslations();
  loadDays().catch((error) => setStatus(String(error.message || error), true));
});

let locationTimer;
dom.locationFilter.addEventListener("input", () => {
  window.clearTimeout(locationTimer);
  locationTimer = window.setTimeout(() => {
    loadDays().catch((error) => setStatus(String(error.message || error), true));
  }, 350);
});

setLang(currentLang);
applyTranslations();
loadDays().catch((error) => setStatus(String(error.message || error), true));
