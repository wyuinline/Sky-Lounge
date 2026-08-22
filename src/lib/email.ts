import type { ReminderCandidate } from "@/lib/reminders";

/**
 * Email delivery via Resend.
 *
 * Sending is optional by design: if the integration isn't configured the job
 * still records every reminder in the notification centre and reports how many
 * it skipped. A missing API key degrades the feature, it doesn't fail the run.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL);
}

const severityPrefix: Record<ReminderCandidate["severity"], string> = {
  critical: "Overdue",
  high: "Action needed",
  medium: "Upcoming",
  low: "Heads up",
};

function renderDigest(reminders: ReminderCandidate[]): string {
  const rows = reminders
    .map(
      (r) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e3e4dc;">
            <div style="font-weight:600;color:#333f48;">${escapeHtml(r.title)}</div>
            <div style="color:#6b7480;font-size:14px;margin-top:2px;">${escapeHtml(r.body)}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e3e4dc;white-space:nowrap;vertical-align:top;">
            <span style="font-size:12px;font-weight:600;color:#44646c;">
              ${severityPrefix[r.severity]}
            </span>
          </td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fffef8;padding:24px;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="background:#333f48;color:#fffef8;padding:20px 24px;border-radius:6px;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#c4e86c;font-weight:600;">
            Compliance Digest
          </div>
          <div style="font-size:24px;font-weight:600;margin-top:6px;">UAV Operations Portal</div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#ffffff;margin-top:16px;border-radius:6px;overflow:hidden;">
          ${rows}
        </table>
        <p style="color:#6b7480;font-size:13px;margin-top:16px;">
          You are receiving this because these items are assigned to you or your role.
        </p>
      </div>
    </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends one digest per recipient. Returns the addresses that failed rather
 * than throwing, so one bad address cannot stop the rest of the run.
 */
export async function sendReminderDigest(
  to: string,
  reminders: ReminderCandidate[],
): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email is not configured." };
  }
  if (reminders.length === 0) {
    return { ok: true };
  }

  const critical = reminders.filter((r) => r.severity === "critical").length;
  const subject = critical
    ? `${critical} overdue compliance item${critical === 1 ? "" : "s"} — UAV Operations`
    : `${reminders.length} upcoming compliance item${reminders.length === 1 ? "" : "s"} — UAV Operations`;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM_EMAIL,
        to,
        subject,
        html: renderDigest(reminders),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[reminders] Resend rejected the send", response.status, detail);
      return { ok: false, error: `Resend returned ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[reminders] email send failed", error);
    return { ok: false, error: "Email request failed." };
  }
}
