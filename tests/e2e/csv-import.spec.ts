import { test, expect } from '@playwright/test'
import {
    IDS,
    asSuperAdmin,
    mockUnitName,
    mockMembers,
    mockIsSuperAdminRpc,
    silenceRealtime,
    SUPABASE_URL,
} from './helpers'

test.describe('CSV Import Duplicate Detection', () => {
    test.beforeEach(async ({ page }) => {
        silenceRealtime(page)
        await asSuperAdmin(page)
        await mockIsSuperAdminRpc(page)
        // Mock existing members: Alice Johnson and Bob Smith
        await mockMembers(page)
        await mockUnitName(page)
    })

    test('detects exact and fuzzy duplicates in CSV preview', async ({ page }) => {
        await page.goto(`/admin/units/${IDS.unit}/members`)

        // Wait for members to load to ensure state is ready for duplicate detection logic
        await expect(page.getByText('Alice Johnson')).toBeVisible()

        // Open import panel
        await page.getByRole('button', { name: /Import CSV/i }).click()

        // CSV Content:
        // Name,Phone,Section,Status
        // Alice Johnson,+2348001234567,Soprano,active  <-- Exact duplicate
        // Alice J,,Soprano,active                       <-- Fuzzy duplicate
        // Dave Miller,+2348001112222,Tenor,active       <-- New member
        const csvContent = [
            'Name,Phone,Section,Status',
            'Alice Johnson,+2348001234567,Soprano,active',
            'Alice J,,Soprano,active',
            'Dave Miller,+2348001112222,Tenor,active',
        ].join('\n')

        await page.setInputFiles('input[type="file"]', {
            name: 'members.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(csvContent)
        })

        // Exact duplicate row uses bg-red-500/10 class
        const exactRow = page.locator('tr').filter({ hasText: 'Alice Johnson' }).filter({ has: page.locator('.bg-red-500\\/10, [class*="bg-red-500"]') })
        await expect(exactRow.first()).toBeVisible()

        // The "Duplicate" badge on exact duplicate row
        await expect(page.locator('span', { hasText: 'Duplicate' }).first()).toBeVisible()

        // The "Similar" badge on fuzzy duplicate row
        await expect(page.locator('span', { hasText: 'Similar' }).first()).toBeVisible()

        // New member row has no red/amber background
        const okRow = page.locator('tr').filter({ hasText: 'Dave Miller' })
        await expect(okRow).toBeVisible()

        // Verify summary warnings
        await expect(page.getByText('1 row(s) match existing members exactly and will be skipped.')).toBeVisible()
        await expect(page.getByText(/1 row\(s\) have names similar to existing members/)).toBeVisible()

        // Import button shows filtered count (3 rows in CSV - 1 exact = 2 members to import)
        await expect(page.getByRole('button', { name: 'Import 2 members' })).toBeVisible()
    })

    test('filters out exact duplicates on import', async ({ page }) => {
        await page.goto(`/admin/units/${IDS.unit}/members`)

        // Wait for members to load
        await expect(page.getByText('Alice Johnson')).toBeVisible()

        await page.getByRole('button', { name: /Import CSV/i }).click()

        const csvContent = [
            'Name,Phone,Section,Status',
            'Alice Johnson,+2348001234567,Soprano,active', // Skip
            'Dave Miller,+2348001112222,Tenor,active',     // Import
        ].join('\n')

        await page.setInputFiles('input[type="file"]', {
            name: 'members.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(csvContent)
        })

        // Intercept the insert call to verify the payload
        let capturedPayload: Record<string, unknown>[] = []
        await page.route(`${SUPABASE_URL}/rest/v1/members*`, async route => {
            if (route.request().method() === 'POST') {
                capturedPayload = JSON.parse(route.request().postData() || '[]')
                // Return success with the new member only
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify([{ id: 'new-id-1', name: 'Dave Miller', unit_id: IDS.unit, status: 'active' }])
                })
            } else {
                // Fallback for GET members
                const data = [
                    { id: IDS.member1, unit_id: IDS.unit, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', status: 'active', created_at: '2024-01-01T00:00:00Z' },
                    { id: IDS.member2, unit_id: IDS.unit, name: 'Bob Smith', phone: null, section: 'Bass', status: 'active', created_at: '2024-01-01T00:00:00Z' },
                ]
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
            }
        })

        const importBtn = page.getByRole('button', { name: 'Import 1 member' })
        await expect(importBtn).toBeEnabled()
        const csvPostResponse = page.waitForResponse(
            resp => resp.url().includes('/rest/v1/members') && resp.request().method() === 'POST'
        )
        await importBtn.click()
        await csvPostResponse

        // Verify the payload only contains Dave Miller
        expect(capturedPayload).toHaveLength(1)
        expect(capturedPayload[0].name).toBe('Dave Miller')
        expect(capturedPayload.find(p => p.name === 'Alice Johnson')).toBeUndefined()

        // Verify success state — component shows "Transfer Complete!"
        await expect(page.getByText('Transfer Complete!')).toBeVisible()
    })
})
