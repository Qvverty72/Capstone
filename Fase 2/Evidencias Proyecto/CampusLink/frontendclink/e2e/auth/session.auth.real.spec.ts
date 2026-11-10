import { test, expect, responseAction } from '../fixtures/writes';
import { logout } from '../helpers/auth';
import { mailboxRequest } from '../helpers/mailbox';
import { setTimeout as wait } from 'node:timers/promises';

test.describe('Autenticación con proveedor real @real @auth', () => {
  test('registro: un dominio ajeno al catálogo no permite crear cuenta', async ({ page }) => {
    const options = await responseAction(page, 'GET', /\/auth\/registration-options$/, () => page.goto('/register'));
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((o: { dominio: string }) => o.dominio === 'registro-no-admitido.example')).toBe(false);
    await page.getByLabel('Correo institucional', { exact: true }).fill('qa@registro-no-admitido.example');
    await expect(page.getByRole('button', { name: /^Campus:/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeDisabled();
  });

  test('recuperación: cuenta inexistente y rechazo real de OTP inválido', async ({ ui }) => {
    const page = await ui.page('sujeto'); await logout(page);
    await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
    await expect(page.getByRole('heading', { name: '¿Olvidaste tu contraseña?', exact: true })).toBeVisible();
    // Esta identidad no se crea: GoTrue no debe enviar correo a una cuenta QA .invalid.
    // La entrega correcta se verifica solo en el caso separado con buzón autorizado.
    const absentEmail = `sin-cuenta.${ui.manifest.runId}@campuslink.invalid`;
    expect(ui.manifest.users.some(user => user.email === absentEmail)).toBe(false);
    await page.getByRole('textbox', { name: 'Correo', exact: true }).fill(absentEmail);
    const requested = await responseAction(page, 'POST', /\/auth\/recover$/, () => page.getByRole('button', { name: 'Enviar código', exact: true }).click(), 202);
    expect(requested.status).toBe('recovery_requested'); // 202 no demuestra entrega de correo.
    await page.getByLabel('Código de recuperación', { exact: true }).fill('000000');
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('NuevaClaveSinteticaQA123!');
    await page.getByLabel('Repetir nueva contraseña', { exact: true }).fill('NuevaClaveSinteticaQA123!');
    await responseAction(page, 'POST', /\/auth\/recover\/confirm$/, () => page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click(), 400);
    await expect(page.getByText(/No se pudo recuperar la cuenta/)).toBeVisible();
  });

  test('vencimiento local: renueva la sesión contra Supabase y conserva la identidad', async ({ ui }) => {
    const page = await ui.page('receptor');
    test.info().annotations.push({ type: 'fault-injection', description: 'Se adelanta expires_at de la sesión persistida; el JWT del servidor conserva su TTL real. Refresh token y validación /me reales.' });
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
      if (!key) throw new Error('Sesión persistida no encontrada');
      const s = JSON.parse(localStorage.getItem(key)!); s.expires_at = Math.floor(Date.now() / 1000) - 1;
      localStorage.setItem(key, JSON.stringify(s));
    });
    const refreshed = page.waitForResponse(r => r.url().includes('/auth/v1/token?grant_type=refresh_token') && r.request().method() === 'POST', { timeout: 60_000 });
    await page.reload(); expect((await refreshed).status()).toBe(200);
    await expect(page.getByText(ui.user('receptor').name, { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test('sesión revocada: un refresh rechazado vuelve al login sin rutas privadas', async ({ ui }) => {
    const page = await ui.page('sujeto');
    test.info().annotations.push({ type: 'fault-injection', description: 'Se revoca solo la sesión QA real y se fuerza su vencimiento local para ejercitar el refresh rechazado.' });
    const session = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
      if (!key) throw new Error('Sesión no encontrada');
      return JSON.parse(localStorage.getItem(key)!);
    });
    const revoked = await fetch(process.env.E2E_QA_AUTH_URL + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: process.env.E2E_QA_AUTH_KEY!, Authorization: 'Bearer ' + session.access_token } });
    expect(revoked.status).toBe(204);
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k))!;
      const s = JSON.parse(localStorage.getItem(key)!); s.expires_at = 1; localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('tab', { name: 'Mercado', exact: true })).toHaveCount(0);
  });

  test('registro admitido, OTP entregado y recuperación completa en buzón real', async ({ page, ui }) => {
    test.setTimeout(420_000);
    const reg = ui.manifest.registration;
    test.skip(!reg || !['imap', 'file'].includes(process.env.QA_MAILBOX_MODE ?? ''), 'Requiere QA_MAILBOX_EMAIL y QA_MAILBOX_MODE=imap|file con acceso al buzón. No se afirma entrega SMTP sin leer el mensaje.');
    if (!reg) return;
    await page.goto('/register');
    await page.getByLabel('Nombre completo', { exact: true }).fill(reg.name);
    await page.getByLabel('Correo institucional', { exact: true }).fill(reg.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(reg.password);
    await page.getByRole('button', { name: /^Campus:/ }).click();
    await page.getByRole('radiogroup', { name: 'Campus disponibles', exact: true }).getByRole('radio', { name: reg.campusName, exact: true }).click();
    await page.getByRole('checkbox').check();
    const readSignup = await mailboxRequest(reg.email, 'registration');
    const requestedAt = Date.now();
    await responseAction(page, 'POST', /\/auth\/register$/, () => page.getByRole('button', { name: 'Crear cuenta', exact: true }).click(), 202);
    await page.getByLabel('Código de verificación', { exact: true }).fill(await readSignup());
    await responseAction(page, 'POST', /\/auth\/register\/confirm$/, () => page.getByRole('button', { name: 'Verificar correo', exact: true }).click());
    await expect(page.getByRole('heading', { name: 'Cuenta verificada', exact: true })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: 'Continuar', exact: true }).click();
    await page.getByRole('tab', { name: 'Perfil', exact: true }).click();
    await expect(page.getByText(reg.name, { exact: true }).first()).toBeVisible();
    await logout(page);
    // GoTrue limita envíos al mismo destinatario: se respeta su ventana antes de solicitar otro correo.
    const gate = requestedAt + 61_000;
    if (Date.now() < gate) await wait(gate - Date.now());
    await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
    await expect(page.getByRole('heading', { name: '¿Olvidaste tu contraseña?', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Correo', exact: true }).fill(reg.email);
    const readRecovery = await mailboxRequest(reg.email, 'recovery');
    await responseAction(page, 'POST', /\/auth\/recover$/, () => page.getByRole('button', { name: 'Enviar código', exact: true }).click(), 202);
    const otp = await readRecovery(), nextPassword = reg.password + 'New2!';
    await page.getByLabel('Código de recuperación', { exact: true }).fill(otp);
    await page.getByLabel('Nueva contraseña', { exact: true }).fill(nextPassword);
    await page.getByLabel('Repetir nueva contraseña', { exact: true }).fill(nextPassword);
    await responseAction(page, 'POST', /\/auth\/recover\/confirm$/, () => page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click());
    const endpoint = ui.manifest.apiOrigin + '/api/v1/auth/login';
    for (const [password, status] of [[reg.password, 401], [nextPassword, 200]] as const) {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: reg.email, password }) });
      expect(response.status).toBe(status);
    }
    const replay = await fetch(ui.manifest.apiOrigin + '/api/v1/auth/recover/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: reg.email, password: nextPassword, code: otp }) });
    expect(replay.status).toBe(400);
  });
});
