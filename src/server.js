import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import {
  createBooking,
  getBookingByRef,
  listAdminDays,
  listAppointments,
  listPublicDays,
  runMigrations,
  upsertAvailableDay
} from "./db.js";
import { sendConfirmationEmail } from "./email.js";
import { isIsoDate } from "./time.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");
const port = Number(process.env.PORT || 3000);
const adminKey = process.env.ADMIN_KEY || "change-me";

runMigrations();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: "Niet gevonden" });
}

function unauthorized(res) {
  json(res, 401, { error: "Geen toegang voor admin-endpoint." });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload te groot."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Ongeldige JSON payload."));
      }
    });
    req.on("error", reject);
  });
}

function ensureAdmin(req, res) {
  const provided = req.headers["x-admin-key"];
  if (!provided || provided !== adminKey) {
    unauthorized(res);
    return false;
  }
  return true;
}

function serveFile(res, filepath) {
  if (!fs.existsSync(filepath)) {
    notFound(res);
    return;
  }
  const ext = path.extname(filepath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filepath).pipe(res);
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/public/days") {
    const location = url.searchParams.get("location") || "";
    const days = listPublicDays({ location });
    return json(res, 200, { days });
  }

  if (req.method === "POST" && url.pathname === "/api/public/book") {
    try {
      const body = await parseBody(req);
      const booking = createBooking(body);
      let emailStatus = { sent: false };
      try {
        emailStatus = await sendConfirmationEmail(booking);
      } catch (error) {
        emailStatus = { sent: false, reason: String(error.message || error) };
      }
      return json(res, 201, { booking, emailStatus });
    } catch (error) {
      return json(res, 400, { error: String(error.message || error) });
    }
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/public/booking/")) {
    const bookingRef = decodeURIComponent(url.pathname.replace("/api/public/booking/", ""));
    const booking = getBookingByRef(bookingRef);
    if (!booking) {
      return notFound(res);
    }
    return json(res, 200, { booking });
  }

  if (url.pathname.startsWith("/api/admin/")) {
    if (!ensureAdmin(req, res)) {
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/admin/days") {
    const location = url.searchParams.get("location") || "";
    const days = listAdminDays({ location });
    return json(res, 200, { days });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/days") {
    try {
      const body = await parseBody(req);
      upsertAvailableDay({
        serviceDate: body.serviceDate,
        location: String(body.location || "").trim(),
        capacity: Number(body.capacity),
        isEnabled: Boolean(body.isEnabled)
      });
      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 400, { error: String(error.message || error) });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/admin/appointments") {
    try {
      const serviceDate = url.searchParams.get("serviceDate") || "";
      const location = url.searchParams.get("location") || "";
      if (!isIsoDate(serviceDate)) {
        throw new Error("serviceDate is verplicht en moet YYYY-MM-DD zijn.");
      }
      const appointments = listAppointments({ serviceDate, location });
      return json(res, 200, { appointments });
    } catch (error) {
      return json(res, 400, { error: String(error.message || error) });
    }
  }

  return notFound(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${port}`}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      serveFile(res, path.join(publicDir, "index.html"));
      return;
    }
    if (url.pathname === "/admin" || url.pathname === "/admin.html") {
      serveFile(res, path.join(publicDir, "admin.html"));
      return;
    }

    const relativePath = path
      .normalize(decodeURIComponent(url.pathname))
      .replace(/^[/\\]+/, "");
    const filePath = path.resolve(publicDir, relativePath);
    if (!filePath.startsWith(publicDir)) {
      notFound(res);
      return;
    }
    serveFile(res, filePath);
  } catch (error) {
    json(res, 500, { error: `Serverfout: ${String(error.message || error)}` });
  }
});

server.listen(port, () => {
  console.log(`Server gestart op http://localhost:${port}`);
  if (adminKey === "change-me") {
    console.log("Let op: ADMIN_KEY staat nog op standaardwaarde 'change-me'.");
  }
});
