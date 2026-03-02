const EMAIL_TEXT = {
  nl: (booking) => ({
    subject: `Bevestiging mondzorg afspraak ${booking.serviceDate}`,
    text:
      `Beste ${booking.parentName},\n\n` +
      `Uw aanmelding is bevestigd.\n` +
      `Datum: ${booking.serviceDate}\n` +
      `Tijd: ${booking.startTime} - ${booking.endTime} (Europe/Amsterdam)\n` +
      `Locatie: ${booking.location}\n` +
      `Boekingscode: ${booking.bookingRef}\n\n` +
      `Met vriendelijke groet,\nPreventieve mondzorg`
  }),
  en: (booking) => ({
    subject: `Preventive dental booking confirmation ${booking.serviceDate}`,
    text:
      `Dear ${booking.parentName},\n\n` +
      `Your registration is confirmed.\n` +
      `Date: ${booking.serviceDate}\n` +
      `Time: ${booking.startTime} - ${booking.endTime} (Europe/Amsterdam)\n` +
      `Location: ${booking.location}\n` +
      `Booking code: ${booking.bookingRef}\n\n` +
      `Kind regards,\nPreventive dental care team`
  }),
  uk: (booking) => ({
    subject: `Підтвердження запису на профілактичний огляд ${booking.serviceDate}`,
    text:
      `Шановний(а) ${booking.parentName},\n\n` +
      `Ваш запис підтверджено.\n` +
      `Дата: ${booking.serviceDate}\n` +
      `Час: ${booking.startTime} - ${booking.endTime} (Europe/Amsterdam)\n` +
      `Локація: ${booking.location}\n` +
      `Код бронювання: ${booking.bookingRef}\n\n` +
      `З повагою,\nКоманда профілактичної стоматології`
  })
};

export async function sendConfirmationEmail(booking) {
  if (!booking.parentEmail) {
    return { sent: false, reason: "no-email" };
  }

  const lang = EMAIL_TEXT[booking.language] ? booking.language : "nl";
  const content = EMAIL_TEXT[lang](booking);

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    console.log("[email:not-configured]", {
      to: booking.parentEmail,
      subject: content.subject
    });
    return { sent: false, reason: "not-configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [booking.parentEmail],
      subject: content.subject,
      text: content.text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`E-mail versturen mislukt: ${response.status} ${body}`);
  }

  return { sent: true };
}
