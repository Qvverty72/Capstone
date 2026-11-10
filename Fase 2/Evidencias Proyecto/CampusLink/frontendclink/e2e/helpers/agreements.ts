import { type Page } from '@playwright/test';
import { expect, responseAction, type UIHarness } from '../fixtures/writes';
import type { Resource } from './resources';
import { navigate } from './navigation';

export async function requestResource(page: Page, resource: Resource, digital = false) {
  await page.getByRole('button', { name: 'Solicitar este recurso', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Mensajes disponibles', exact: true }).getByRole('radio').first().click();
  const request = await responseAction(page, 'POST', new RegExp(`/${digital ? 'elibrary' : 'physicalgoods'}/${resource.id}/requests$`), () => page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click(), 201);
  expect(request.id).toBeTruthy();
  return request;
}
export async function personal(page: Page, tab: 'Solicitudes' | 'Transacciones' | 'Adquiridos', digital = false) {
  await page.reload();
  await navigate(page, digital ? 'Biblioteca' : 'Mercado');
  await page.getByRole('button', { name: digital ? /^Mi biblioteca/ : /^Mi actividad/ }).click();
  await page.getByRole('tab', { name: new RegExp('^' + tab) }).click();
}
export async function acceptRequest(page: Page, ui: UIHarness, resource: Resource, digital = false) {
  await personal(page, 'Solicitudes', digital);
  await page.getByRole('tab', { name: /^Recibidas/ }).click();
  await page.getByRole('button', { name: new RegExp(`^Ver \\d+ solicitud(?:es)? de ${resource.title}$`) }).click();
  await page.getByRole('button', { name: `Revisar solicitud de ${ui.user('receptor').name}`, exact: true }).click();
  await page.getByRole('button', { name: `Aceptar solicitud de ${ui.user('receptor').name}`, exact: true }).click();
  const accepted = await responseAction(page, 'PATCH', new RegExp(`/${digital ? 'elibrary' : 'physicalgoods'}/${resource.id}/requests/[^/]+$`), () => page.getByRole('button', { name: 'Confirmar aceptación', exact: true }).click());
  const transactionId = accepted.transactionId ?? accepted.transaction?.id;
  expect(transactionId).toBeTruthy(); return transactionId as string;
}
export async function confirmAgreement(page: Page, resource: Resource, transactionId: string, digital = false) {
  await personal(page, 'Transacciones', digital);
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const path = new RegExp(`/${digital ? 'elibrary' : 'physicalgoods'}/${resource.id}/transactions/${transactionId}/confirm$`);
  return responseAction(page, 'POST', path, () => page.getByRole('button', { name: 'Confirmar que se realizó', exact: true }).click());
}
export async function rateAgreement(page: Page, resource: Resource, transactionId: string, digital = false) {
  await page.getByRole('radio', { name: 'Puntuar con 5 de 5', exact: true }).click();
  const rating = await responseAction(page, 'POST', new RegExp(`/${digital ? 'elibrary' : 'physicalgoods'}/${resource.id}/transactions/${transactionId}/rating$`), () => page.getByRole('button', { name: 'Enviar valoración', exact: true }).click(), 201);
  expect(rating).toBeTruthy();
  await expect(page.getByText('Gracias por valorar', { exact: true })).toBeVisible();
}
