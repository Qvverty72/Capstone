/**
 * Punto de entrada del proceso Node: carga dotenv antes de importar la aplicación.
 * Coordina el servidor HTTP y los dos workers periódicos; bootstrap conserva
 * la responsabilidad de conexiones, readiness y liberación de recursos.
 */
import 'dotenv/config';

// La carga dinámica permite que los fallos de configuración y drivers usen el registro seguro.
/**
 * Inicia la API y registra un cierre idempotente para SIGINT/SIGTERM.
 * El cierre espera primero los dos workers y después delega HTTP y conexiones
 * a stopApi; un fallo de arranque termina el proceso con código 1.
 * Devuelve: Promesa resuelta tras instalar servidor, workers y señales.
 */
async function main(): Promise<void> {
  const { startApi, stopApi } = await import('./bootstrap.js');
  const { env } = await import('./config/env.js');
  const server = await startApi();
  const { startActivityNotificationWorker } = await import('./modules/activities/workers/activities.notifications.worker.js');
  const stopNotifications = startActivityNotificationWorker();
  const { startPhysicalgoodsReminderWorker } = await import('./modules/marketplace/physicalgoods/workers/physicalgoods.reminders.worker.js');
  const stopPhysicalgoodsReminders = startPhysicalgoodsReminderWorker();
  console.log('CampusLink API running on port ' + env.port);
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    try { await Promise.all([stopNotifications(),stopPhysicalgoodsReminders()]); await stopApi(server); }
    catch { console.error('API shutdown failed'); process.exitCode = 1; }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
main().catch(() => {
  console.error('Unable to start CampusLink API. Check environment settings and required database access.');
  process.exit(1);
});
