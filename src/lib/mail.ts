import nodemailer from "nodemailer";

function getMailTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD must be configured.");
  }

  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

export function assertMailConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new Error(
      "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured.",
    );
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  assertMailConfigured();
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_FROM must be configured.");

  await getMailTransport().sendMail({
    from,
    to: email,
    subject: "Reset your IDAI STORES 43 password",
    text: `Use this one-time link to reset your password. It expires in 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
    html: `<p>Use this one-time link to reset your password. It expires in 30 minutes:</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this message.</p>`,
  });
}

export async function sendPasswordResetCode(email: string, code: string) {
  assertMailConfigured();
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_FROM must be configured.");

  await getMailTransport().sendMail({
    from,
    to: email,
    subject: "Your IDAI STORES 43 password reset code",
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this message.`,
    html: `<p>Your IDAI STORES 43 password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:0.25em">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this message.</p>`,
  });
}

export async function sendContactEmail(input: {
  name: string;
  email: string;
  message: string;
}) {
  assertMailConfigured();
  const from = process.env.SMTP_FROM;
  const recipient = process.env.CONTACT_EMAIL ?? from;
  if (!from || !recipient) throw new Error("SMTP_FROM or CONTACT_EMAIL must be configured.");

  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
  const message = input.message.trim();
  await getMailTransport().sendMail({
    from,
    to: recipient,
    replyTo: input.email,
    subject: `IDAI STORES 43 contact message from ${input.name}`,
    text: `Name: ${input.name}\nEmail: ${input.email}\n\n${message}`,
    html: `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p><p><strong>Email:</strong> ${escapeHtml(input.email)}</p><p>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</p>`,
  });
}
