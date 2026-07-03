import { expect, test } from '@playwright/test';

test('placeholder shell renders with phase status readout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Spectral Prism');
  await expect(page.getByRole('heading', { name: 'Spectral Prism' })).toBeVisible();
  await expect(page.getByTestId('phase-status')).toContainText('phase 0');
});
