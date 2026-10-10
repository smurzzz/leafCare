/**
 * Triggers the reminder job the same way a scheduler would.
 *
 * Usage: npm run job:reminders --workspace @leafcare/api -- http://localhost:3000
 */

const baseUrl = process.argv[2] ?? process.env.API_BASE_URL ?? 'http://localhost:3000';
const secret = process.env.CRON_SECRET;

const run = async (): Promise<void> => {
  const response = await fetch(`${baseUrl}/api/jobs/reminders`, {
    method: 'POST',
    headers: secret ? { 'x-cron-secret': secret } : {},
  });
  const body = await response.text();
  console.log(`[job] ${response.status} ${body}`);
  if (!response.ok) process.exit(1);
};

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
