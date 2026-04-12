import { expect, test, type Page } from '@playwright/test';
import { apiJson, closeActors, loginAsRole, openCustomPage, openRolePage, rolePassword, uniquePhone } from './support';
import type { DemoRole } from './support';

async function expectVisibleLinks(page: Page, hrefs: string[]): Promise<void> {
  for (const href of hrefs) {
    await expect(page.locator(`aside.sidebar a[href="${href}"]`).first()).toBeVisible({ timeout: 15_000 });
  }
}

async function expectHiddenLinks(page: Page, hrefs: string[]): Promise<void> {
  for (const href of hrefs) {
    await expect(page.locator(`aside.sidebar a[href="${href}"]`)).toHaveCount(0);
  }
}

test.describe('Auth + dashboard shell browser-first UI coverage', () => {
  test('B01 restore session tu cookie sau khi reload trang', async ({ browser, request }) => {
    const actor = await openRolePage(browser, request, 'director', '/app/dashboard');

    try {
      const userName = actor.page.locator('.user-info .user-name');
      const rememberedName = (await userName.textContent())?.trim();

      await expect(actor.page).toHaveURL(/\/app\/dashboard$/);
      await expect(actor.page.locator('aside.sidebar')).toBeVisible();
      await expect(userName).toBeVisible();

      await actor.page.reload({ waitUntil: 'networkidle' });

      await expect(actor.page).toHaveURL(/\/app\/dashboard$/);
      await expect(actor.page).not.toHaveURL(/\/login$/);
      await expect(actor.page.locator('aside.sidebar')).toBeVisible();
      await expect(userName).toBeVisible();
      if (rememberedName) {
        await expect(userName).toHaveText(rememberedName);
      }
    } finally {
      await closeActors(actor);
    }
  });

  test('B01 menu trai hien thi dung theo role dai dien', async ({ browser, request }) => {
    test.slow();

    const builtInRoleMatrix: Array<{
      role: DemoRole;
      path: string;
      visible: string[];
      hidden: string[];
    }> = [
      {
        role: 'director',
        path: '/app/orders',
        visible: ['/app/classes', '/app/agents', '/app/pending-approvals', '/app/internal-handbook'],
        hidden: ['/app/parent-chat'],
      },
      {
        role: 'accounting',
        path: '/app/dashboard',
        visible: ['/app/expenses', '/app/financial-control', '/app/loans', '/app/staff-payroll', '/app/classes'],
        hidden: ['/app/pending-approvals', '/app/leads', '/app/ads-management'],
      },
      {
        role: 'sale',
        path: '/app/orders',
        visible: ['/app/leads', '/app/orders', '/app/commission-report', '/app/sale-hub'],
        hidden: ['/app/classes', '/app/agents', '/app/pending-approvals'],
      },
      {
        role: 'parent',
        path: '/app/parent-calendar',
        visible: ['/app/parent-invoices', '/app/parent-chat', '/app/parent-attendance', '/app/notifications'],
        hidden: ['/app/ads-management', '/app/conversations', '/app/pending-approvals'],
      },
    ];

    for (const item of builtInRoleMatrix) {
      const actor = await openRolePage(browser, request, item.role, item.path);
      try {
        await expect(actor.page.locator('aside.sidebar')).toBeVisible();
        await expectVisibleLinks(actor.page, item.visible);
        await expectHiddenLinks(actor.page, item.hidden);
      } finally {
        await closeActors(actor);
      }
    }

    const directorSession = await loginAsRole(request, 'director');
    const digits = Date.now().toString().slice(-10);
    const shareholderEmail = `e2e-shareholder-${digits}@school.local`;
    const shareholder = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/users',
      {
        userCode: `SH${digits}`,
        email: shareholderEmail,
        password: rolePassword(),
        fullName: `E2E Shareholder ${digits}`,
        role: 'SHAREHOLDER',
        phone: uniquePhone(`shareholder-${digits}`),
        ownershipPercentage: 15,
      },
    );

    const shareholderActor = await openCustomPage(
      browser,
      request,
      'shareholder',
      shareholder.email,
      rolePassword(),
      '/app/investor-dashboard',
    );

    try {
      await expect(shareholderActor.page.locator('aside.sidebar')).toBeVisible();
      await expectVisibleLinks(shareholderActor.page, ['/app/investor-dashboard', '/app/ads-analytics', '/app/financial-control', '/app/aging-report']);
      await expectHiddenLinks(shareholderActor.page, ['/app/notifications', '/app/internal-handbook', '/app/tickets']);
    } finally {
      await closeActors(shareholderActor);
    }
  });

  test('B01 active link sidebar dung theo route va query param', async ({ browser, request }) => {
    const actor = await openRolePage(browser, request, 'director', '/app/users?role=PARENT');

    try {
      const parentAccountsLink = actor.page.locator('aside.sidebar a[href="/app/users?role=PARENT"]').first();
      const usersLink = actor.page.locator('aside.sidebar a[href="/app/users"]').first();

      await expect(actor.page).toHaveURL(/\/app\/users\?role=PARENT$/);
      await expect(parentAccountsLink).toHaveClass(/active/);
      await expect(usersLink).not.toHaveClass(/active/);

      await usersLink.click();
      await expect(actor.page).toHaveURL(/\/app\/users$/);
      await expect(usersLink).toHaveClass(/active/);
      await expect(parentAccountsLink).not.toHaveClass(/active/);
    } finally {
      await closeActors(actor);
    }
  });

  test('B02 quick links trong cam nang dieu huong dung theo route da render', async ({ browser, request }) => {
    test.slow();

    const roles: DemoRole[] = ['accounting', 'sale'];

    for (const role of roles) {
      const actor = await openRolePage(browser, request, role, '/app/internal-handbook');
      try {
        const firstQuickLink = actor.page.locator('.link-card').first();
        const expectedRoute = ((await firstQuickLink.locator('code').textContent()) || '').trim();

        await expect(actor.page.locator('.handbook-page')).toBeVisible({ timeout: 15_000 });
        await expect(firstQuickLink).toBeVisible();
        expect(expectedRoute, `Missing quick link route for role ${role}`).toMatch(/^\/app\//);

        await firstQuickLink.click();

        await expect(actor.page).toHaveURL(new RegExp(`${expectedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), {
          timeout: 15_000,
        });
        await expect(actor.page).not.toHaveURL(/\/login$/);
        await expect(actor.page).not.toHaveURL(/\/not-authorized$/);
      } finally {
        await closeActors(actor);
      }
    }
  });

  test('B02 gallery va video trong cam nang tai duoc va hien thi on dinh', async ({ browser, request }) => {
    const actor = await openRolePage(browser, request, 'accounting', '/app/internal-handbook');

    try {
      const firstGalleryImage = actor.page.locator('.gallery-card img').first();
      const firstVideo = actor.page.locator('.video-card video').first();
      const firstVideoSource = firstVideo.locator('source').first();

      await expect(actor.page.locator('.handbook-page[data-role="ACCOUNTING"]')).toBeVisible({ timeout: 15_000 });
      await expect(actor.page.locator('.gallery-card')).not.toHaveCount(0);
      await expect(firstGalleryImage).toBeVisible();
      await expect
        .poll(async () => firstGalleryImage.evaluate((img) => (img as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);

      await expect(actor.page.locator('.video-card')).not.toHaveCount(0);
      await expect(firstVideo).toBeVisible();
      await expect(firstVideoSource).toHaveAttribute('src', /.+/);
    } finally {
      await closeActors(actor);
    }
  });
});
