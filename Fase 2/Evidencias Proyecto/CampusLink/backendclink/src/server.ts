/**
 * Punto de entrada del proceso Node: carga dotenv antes de importar la aplicación.
 * Coordina el servidor HTTP y los dos workers periódicos; bootstrap conserva
 * la responsabilidad de conexiones, readiness y liberación de recursos.
 */
import 'dotenv/config';

// La carga dinámica permite que los fallos de configuración y drivers usen el registro seguro.
/**
 * Inicia la API y registra un cierre idempotente para SIGINT/SIGTERM.
 * El límite global de 29 segundos evita dejar el proceso esperando clientes
 * o tareas pendientes indefinidamente; un fallo de arranque termina con código 1.
 * Devuelve: Promesa resuelta tras instalar el servidor, workers y señales.
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
    // El cierre por SIGTERM acota HTTP, workers y pools a 29 segundos;
    // el plazo pertenece al proceso y no depende del stop_grace_period de Compose.
    const deadline = setTimeout(() => {
      console.error('API shutdown deadline exceeded'); process.exit(1);
    }, 29000);
    deadline.unref();
    try { await stopApi(server, () => Promise.all([stopNotifications(), stopPhysicalgoodsReminders()])); }
    catch { console.error('API shutdown failed'); process.exitCode = 1; }
    finally { clearTimeout(deadline); }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
main().catch(() => {
  console.error('Unable to start CampusLink API. Check environment settings and required database access.');
  process.exit(1);
});
