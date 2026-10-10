import { environmentReport } from '@/lib/env';

const routes = [
  ['GET', '/api/health', 'Public liveness probe + integration report'],
  ['POST', '/api/identify', 'multipart image → Plant.id/PlantNet → DTO'],
  ['DELETE', '/api/identify/:id', 'Cancel on the identifying sheet'],
  ['GET', '/api/species?q=', 'Manual species search fallback'],
  ['GET/POST', '/api/plants', 'List with computed status / create a plant'],
  ['GET/PATCH/DELETE', '/api/plants/:id', 'Plant detail, edit, delete'],
  ['POST', '/api/plants/:id/water', 'Mark watered, update streak'],
  ['POST', '/api/plants/:id/schedule/reset', 'Restore the recommended interval'],
  ['GET', '/api/home', 'Home / Today payload'],
  ['GET', '/api/reminders?tab=', 'Grouped reminders + completed'],
  ['POST', '/api/reminders/:plantId/snooze', 'Snooze 1h / 3h / tomorrow'],
  ['POST', '/api/reminders/:plantId/done', 'Complete a reminder'],
  ['GET', '/api/care-log?month=', 'Calendar dots, summary, recent feed'],
  ['GET/PATCH/DELETE', '/api/me', 'Profile, stats, achievements, wipe'],
  ['GET/PUT', '/api/me/notifications', 'Notification preferences'],
  ['POST', '/api/me/push-token', 'Register an Expo push token'],
  ['POST', '/api/webhooks/clerk', 'user.created / user.deleted'],
  ['POST', '/api/jobs/reminders', 'Cron: due pushes + daily digest'],
] as const;

export default function ApiLandingPage() {
  const report = environmentReport();
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, lineHeight: 1.5 }}>
      <h1 style={{ marginBottom: 4 }}>LeafCare API</h1>
      <p style={{ color: '#6B7280', marginTop: 0 }}>
        The Expo app talks to these routes; vendor keys never leave the server.
      </p>

      <h2 style={{ fontSize: 18 }}>Configured integrations</h2>
      <ul>
        <li>Clerk: {report.clerk ? '✅' : '❌ missing CLERK_SECRET_KEY'}</li>
        <li>Supabase: {report.supabase ? '✅' : '❌ missing SUPABASE_* keys'}</li>
        <li>Identify provider: {report.identifyProvider}</li>
        <li>
          Clerk webhook: {report.webhook ? '✅' : '❌ missing CLERK_WEBHOOK_SECRET'}
        </li>
        <li>Expo push: {report.push ? '✅' : '❌ missing EXPO_ACCESS_TOKEN'}</li>
      </ul>

      <h2 style={{ fontSize: 18 }}>Routes</h2>
      <table cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {routes.map(([method, path, description]) => (
            <tr key={`${method}-${path}`}>
              <td style={{ border: '1px solid #E7F4EA', fontFamily: 'monospace' }}>{method}</td>
              <td style={{ border: '1px solid #E7F4EA', fontFamily: 'monospace' }}>{path}</td>
              <td style={{ border: '1px solid #E7F4EA' }}>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
