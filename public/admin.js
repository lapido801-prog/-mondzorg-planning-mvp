import { t } from "./i18n.js";

const SUPPORTED_LANGS = ["nl", "en", "uk"];

const dom = {
  langSwitch: document.getElementById("langSwitch"),
  langButtons: Array.from(document.querySelectorAll(".lang-btn[data-lang]")),
  adminKey: document.getElementById("adminKey"),
  location: document.getElementById("location"),
  dayForm: document.getElementById("dayForm"),
  serviceDate: document.getElementById("serviceDate"),
  capacity: document.getElementById("capacity"),
  isEnabled: document.getElementById("isEnabled"),
  refreshDays: document.getElementById("refreshDays"),
  daysTbody: document.getElementById("daysTbody"),
  dayStatus: document.getElementById("dayStatus"),
  appointmentsList: document.getElementById("appointmentsList"),
  appointmentStatus: document.getElementById("appointmentStatus")
};

let currentLang = SUPPORTED_LANGS.includes(window.localStorage.getItem("lang"))
  ? window.localStorage.getItem("lang")
  : "uk";

function getLang() {
  return currentLang;
}

function setStatus(node, message, isError = false) {
  node.textContent = message;
  node.className = isError ? "status error" : "status";
}

function headers() {
  return {
    "Content-Type": "application/json",
    "x-admin-key": dom.adminKey.value.trim()
  };
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
    node.textContent = t(getLang(), node.getAttribute("data-i18n"));
  });
}

async function loadDays() {
  setStatus(dom.dayStatus, "");
  const location = dom.location.value.trim();
  const response = await fetch(`/api/admin/days?location=${encodeURIComponent(location)}`, {
    headers: { "x-admin-key": dom.adminKey.value.trim() }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Kon dagen niet laden.");
  }

  dom.daysTbody.innerHTML = "";
  for (const day of data.days) {
    const row = document.createElement("tr");
    const activeLabel = day.isEnabled === 1 ? t(getLang(), "enabledShort") : t(getLang(), "disabledShort");
    row.innerHTML =
      `<td>${day.serviceDate}</td>` +
      `<td>${day.location}</td>` +
      `<td>${day.capacity}</td>` +
      `<td>${day.bookedCount} (${activeLabel})</td>` +
      `<td><button data-date="${day.serviceDate}" data-location="${day.location}" type="button">${t(getLang(), "view")}</button></td>`;
    dom.daysTbody.append(row);
  }
}

async function saveDay(event) {
  event.preventDefault();
  setStatus(dom.dayStatus, "");

  const payload = {
    serviceDate: dom.serviceDate.value,
    location: dom.location.value.trim(),
    capacity: Number(dom.capacity.value),
    isEnabled: dom.isEnabled.checked
  };

  const response = await fetch("/api/admin/days", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Opslaan mislukt.");
  }
  setStatus(dom.dayStatus, t(getLang(), "saved"));
  await loadDays();
}

async function loadAppointments(serviceDate, location) {
  setStatus(dom.appointmentStatus, "");
  const response = await fetch(
    `/api/admin/appointments?serviceDate=${encodeURIComponent(serviceDate)}&location=${encodeURIComponent(location)}`,
    { headers: { "x-admin-key": dom.adminKey.value.trim() } }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Kon afspraken niet laden.");
  }

  dom.appointmentsList.innerHTML = "";
  if (!data.appointments.length) {
    setStatus(dom.appointmentStatus, t(getLang(), "emptyAppointments"));
    return;
  }
  for (const appointment of data.appointments) {
    const item = document.createElement("li");
    const emailInfo = appointment.parentEmail ? ` (${appointment.parentEmail})` : "";
    item.textContent =
      `${appointment.startTime}-${appointment.endTime} | ${appointment.childName} | ` +
      `${appointment.parentName}${emailInfo} | ${appointment.bookingRef}`;
    dom.appointmentsList.append(item);
  }
}

dom.dayForm.addEventListener("submit", async (event) => {
  try {
    await saveDay(event);
  } catch (error) {
    setStatus(dom.dayStatus, String(error.message || error), true);
  }
});

dom.refreshDays.addEventListener("click", async () => {
  try {
    await loadDays();
  } catch (error) {
    setStatus(dom.dayStatus, String(error.message || error), true);
  }
});

dom.daysTbody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const serviceDate = target.getAttribute("data-date");
  const location = target.getAttribute("data-location");
  if (!serviceDate || !location) {
    return;
  }
  try {
    await loadAppointments(serviceDate, location);
  } catch (error) {
    setStatus(dom.appointmentStatus, String(error.message || error), true);
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
  loadDays().catch((error) => setStatus(dom.dayStatus, String(error.message || error), true));
});

let loadTimer;
function scheduleDaysRefresh() {
  window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(() => {
    loadDays().catch((error) => setStatus(dom.dayStatus, String(error.message || error), true));
  }, 300);
}

dom.location.addEventListener("input", scheduleDaysRefresh);
dom.adminKey.addEventListener("input", scheduleDaysRefresh);

setLang(currentLang);
applyTranslations();
loadDays().catch((error) => setStatus(dom.dayStatus, String(error.message || error), true));
