# Rollcally — User System Guide

> **Version:** 2.0 · **March 2026**
> A plain-language guide for everyone who uses Rollcally — whether you're checking yourself in or running the show.

---

## Table of Contents

1. [What Is Rollcally?](#1-what-is-rollcally)
2. [Getting Started](#2-getting-started)
3. [For Members — Checking In](#3-for-members--checking-in)
4. [For Admins — Managing Your Unit](#4-for-admins--managing-your-unit)
5. [For Org Owners — Running an Organisation](#5-for-org-owners--running-an-organisation)
6. [Roles & What Each Can Do](#6-roles--what-each-can-do)
7. [Tips & Best Practices](#7-tips--best-practices)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. What Is Rollcally?

Rollcally is a **digital attendance system** for groups that meet regularly — choirs, churches, sports teams, youth organisations, and more.

Instead of passing around a clipboard, members simply **scan a QR code** and tap their name. The group leader sees a live dashboard that updates in real time.

**What Rollcally replaces:**
- Paper sign-in sheets
- Manual spreadsheet updates
- Guessing who was absent

**What Rollcally gives you:**
- Instant check-in via QR code
- A live dashboard showing who's present and who's absent
- Individual attendance history per member
- Exportable absence lists
- Birthday reminders for your members
- Everything works on a phone — no app download needed

---

## 2. Getting Started

### If you're a member (checking in at an event)
You don't need an account. When you arrive at your event, look for the QR code posted by your group leader — scan it with your phone's camera and follow the steps. That's it.

See [Section 3](#3-for-members--checking-in) for the full walkthrough.

### If you're an admin (managing a group)

1. **Sign up** at the Rollcally website — click "Admin Portal" on the home page
2. Enter your email and a password (minimum 6 characters)
3. After signing up, log in with those same credentials
4. You'll land on your **Admin Dashboard**

From there you can:
- Create or join an organisation
- Create a unit (your specific group)
- Add your members to the roster
- Create events and generate QR codes

---

## 3. For Members — Checking In

### Step 1 — Scan the QR Code

Your group leader will display a QR code — either on a screen, a printout, or their phone. Open your phone's camera app (no special app needed), point it at the code, and tap the link that appears.

> **No QR code?** Ask your leader for the direct check-in link, or visit the Rollcally website and tap "Check In".

### Step 2 — Find Your Name

You'll see a search box. Type at least 3 letters of your name (first name, last name, or both). Your name will appear in a list grouped by your section.

> Example: typing "ali" will show "Alice Johnson" under Soprano.

### Step 3 — Confirm

Tap your name. A confirmation screen appears asking "Is this you?" with your name and section shown. If it's correct, tap **"Yes, check me in"**.

> Not you? Tap **"No, go back"** and search again.

### Step 4 — Done!

You'll see a green "You're in!" screen with the venue name and your check-in time. You're done — no need to do anything else.

---

### Returning Members — Skip the Search

After your first check-in, Rollcally remembers you on that device. Next time you scan the QR code, you'll see your name already displayed. Just confirm — no searching needed.

> This only works on the same phone/browser you used before. If you switch devices, you'll need to search once.

---

### What if Check-In Is Blocked?

| Message | What it means |
|---|---|
| **"Already checked in"** | You've already been recorded for this event. Nothing to do. |
| **"Too far away"** | Your location is outside the allowed range. Make sure you're physically at the venue. |
| **"Device already in use"** | This device has been used to check in a different member. Ask your leader for help. |
| **"Sync Denied"** | A technical error occurred. Tap "Re-verify Identity" to try again. |

---

## 4. For Admins — Managing Your Unit

Once you're logged in, your dashboard shows all the groups you manage. Here's what you can do with a unit.

---

### 4.1 Your Unit Dashboard

The unit dashboard (`/admin/units/...`) is your home base. It shows:

- **Upcoming sessions** — events scheduled for today or in the future
- **Past sessions** — completed events with their attendance summaries
- **Quick actions** — manage members, create events, view QR code

---

### 4.2 Creating an Event

1. From the unit dashboard, tap **"Create Event"**
2. Select the date and the event type (Rehearsal or Sunday Service)
3. Tap **"Create"**

The event appears immediately. Tap it to open the attendance page.

> You cannot create two events of the same type on the same date.

---

### 4.3 Generating the QR Code

Open any event from your unit dashboard. The **QR code section** is at the top of the attendance page.

- On desktop: the QR code is shown in a sidebar panel
- On mobile: tap to expand the QR section

**To share it:**
- Download the QR code as a PNG image (tap the download button)
- Display it on a screen, print it, or send it to members before the event

The QR code links to the check-in page for **that specific event only**. Each event has its own unique code.

---

### 4.4 Tracking Attendance Live

While members are checking in, your attendance page updates in **real time** — no refreshing needed.

You'll see:
- A live count of **Total / Present / Absent / Rate %**
- Three tabs: **All**, **Present**, **Absent**

You can also **manually mark attendance** by toggling the button on any member's row:
- Toggle to "Mark Present" — records them as present
- Toggle to "Mark Absent" — removes their attendance record

---

### 4.5 Exporting Absence Lists

On the attendance page, switch to the **"Absent"** tab to see who's missing. Three export buttons appear:

| Button | What you get |
|---|---|
| **TXT** | Plain text, good for pasting into messages |
| **CSV** | Spreadsheet format, opens in Excel or Google Sheets |
| **RTF** | Formatted table, opens in Word or similar |

Files download instantly — no email required.

---

### 4.6 Managing Your Roster

Go to **Members** from the unit dashboard to view and manage your full roster.

**Adding a member:**
Tap **"Add Member"**, fill in their name (required), section, phone number, and optionally birthday, then save.

**Editing a member:**
Tap the edit icon on any member row. Change their details and save.

**Retiring a member:**
In the edit form, change their status to "Inactive". They won't appear in future check-in lists but their history is preserved.

**Deleting a member:**
Tap the delete icon. This permanently removes them and their attendance history.

---

### 4.7 Importing Members via CSV

If you have a list of members in a spreadsheet:

1. Export your spreadsheet as a CSV file
2. On the Members page, tap **"Import CSV"**
3. Upload the file — Rollcally will preview it and highlight any duplicates
4. Review the list, then tap **"Import"** to add new members

**Required column:** `Name`
**Optional columns:** `Phone`, `Section`, `Status`, `Birthday`

Rollcally checks for duplicates automatically — it won't add someone who's already in the roster, even if their name is spelled slightly differently ("Jon" vs "John" will be flagged as a possible duplicate).

---

### 4.8 Viewing Member History

Tap any member's name on the roster to open their profile. You'll see:

- **Overall attendance rate** — percentage of events they attended
- **Current streak** — how many consecutive events they've attended
- **Activity chart** — last 10 events as coloured squares (green = present)
- **Full history** — every event, with date and check-in time

---

### 4.9 Birthday Notifications

If members have a birthday stored in their profile, Rollcally will remind you the day before and on the day itself.

Look for the **bell icon** at the top of your admin pages. A number badge shows how many notifications are waiting. Tap the bell to see who has a birthday — and dismiss each one when you've acknowledged it.

---

## 5. For Org Owners — Running an Organisation

An organisation is the top-level container for all your units. As an owner, you have full visibility and control across every unit in your organisation.

---

### 5.1 Creating an Organisation

From the Admin Dashboard, tap **"New"**. Enter a name and tap **"Create"**. Your organisation is ready immediately.

---

### 5.2 Creating Units

Inside your organisation's page, tap **"Create New Unit"**. Give the unit a name and optional description. The unit is created and you're automatically added as its admin.

---

### 5.3 Organisation Dashboard

Your organisation page shows:

- **Total active members** across all units
- **Number of units**
- **Sessions in the last 30 days**
- Per-unit stats: member count and recent sessions

---

### 5.4 Approving Join Requests

Other admins can discover your organisation and request to join. When they do:

1. You'll see a badge on the **"Requests"** tab of your organisation page
2. Each request shows the person's email address
3. Tap **"Approve"** or **"Reject"**

Approved members can see your organisation on their dashboard and create units within it.

---

### 5.5 Joining an Existing Organisation

If you're an admin who wants to join an organisation you didn't create:

1. Go to **"Discover"** (from the admin dashboard)
2. Search for the organisation by name
3. Tap **"Request Access"**
4. Wait for the owner to approve

Once approved, the organisation will appear on your dashboard.

---

### 5.6 Editing or Deleting

- **Rename your organisation:** From the org page, tap the settings icon and update the name.
- **Delete your organisation:** Available in the same settings panel. This permanently removes the organisation and all its units. Use with caution.
- **Edit a unit:** From the unit card on the org page, tap the edit icon.
- **Delete a unit:** Tap the delete icon on the unit card. This removes all members and history for that unit.

---

## 6. Roles & What Each Can Do

| Action | Member (checking in) | Unit Admin | Org Member | Org Owner | Super Admin |
|---|---|---|---|---|---|
| Check in at an event | ✅ | — | — | — | — |
| View unit dashboard | — | ✅ | ✅ | ✅ | ✅ |
| Create events | — | ✅ | — | ✅ | ✅ |
| Mark attendance manually | — | ✅ | — | ✅ | ✅ |
| Add / edit members | — | ✅ | — | ✅ | ✅ |
| Import CSV | — | ✅ | — | ✅ | ✅ |
| Export absence lists | — | ✅ | — | ✅ | ✅ |
| Create units in org | — | — | ✅ | ✅ | ✅ |
| Approve join requests | — | — | — | ✅ | ✅ |
| Create organisations | — | — | — | ✅ | ✅ |
| Add unit admins | — | — | — | — | ✅ |
| Access all organisations | — | — | — | — | ✅ |

**Key:**
- **Member** — someone who uses the check-in page only (no account needed)
- **Unit Admin** — an admin with direct access to a specific unit
- **Org Member** — an admin who has joined an organisation (can create their own units inside it)
- **Org Owner** — the admin who created the organisation (full control)
- **Super Admin** — platform-level administrator (set up by the system operator)

---

## 7. Tips & Best Practices

### For check-in events

**Print and display the QR code.** Displaying a printed QR code on a stand at the entrance is the fastest option — members don't need to wait for someone to show them a phone screen.

**Set up geofencing.** If proxy attendance is a concern (members checking in when they're not actually present), ask your system administrator to enable geofencing on your unit. This restricts check-in to a defined radius around your venue.

**Create the event before the session starts.** The QR code is specific to each event. If you generate it on the day, create the event a few minutes before people arrive so you're not rushing.

**Leave the attendance page open on a tablet or laptop.** The dashboard updates in real time — no refreshing needed. You can glance at the screen to see who's arrived without doing anything.

---

### For managing your roster

**Keep sections consistent.** Section names are free-text (e.g. "Soprano", "Alto", "Tenor", "Bass"). Use the same spelling every time — the member list and exports are grouped by section.

**Add birthdays when registering members.** It only takes a second and unlocks the birthday notification feature. Birthdays are stored as a date (e.g. 15 March) — no year required.

**Use CSV import for large rosters.** If you're starting with an existing spreadsheet, the CSV import is the fastest way to populate your roster. Review the duplicate warnings carefully before confirming.

**Mark members as "Inactive" rather than deleting.** Inactive members are hidden from the check-in list but their history is preserved. Deleting is permanent.

---

### For organisation owners

**Approve join requests promptly.** Admins who have requested access won't see your organisation until you approve them. Check the "Requests" tab regularly.

**Use descriptive unit names.** If you have multiple units (e.g. "Main Choir", "Youth Ensemble", "Bell Ringers"), clear names make it easier for admins to navigate.

---

## 8. Troubleshooting

### I scanned the QR code but nothing happened

- Make sure your phone's camera app is pointed directly at the code and the code is well-lit
- Try moving closer or further away
- If your camera app doesn't open a link automatically, try using the Rollcally website and entering the check-in code manually

---

### I can't find my name in the list

- Check you're spelling your name correctly (try your surname instead of your first name)
- You need to type at least 3 characters before results appear
- Your name might be registered under a slightly different spelling — ask your group leader to check

---

### I see "Already checked in"

This means your attendance for this event has already been recorded. You don't need to do anything else. If you think this is a mistake, let your group leader know.

---

### I see "Too far away"

Your group leader has enabled location checking for this venue. Make sure you are physically at the venue and that you've allowed the website to access your location. If you're inside the venue and still seeing this message, contact your group leader.

---

### I see "Device already in use"

This device (phone or tablet) was previously used by a different person to check in. Let your group leader know — they can manually record your attendance from the admin dashboard.

---

### My organisation isn't showing up on my dashboard

If you've just been approved to join an organisation, switch to another browser tab and come back — the dashboard refreshes automatically when you return to it. If it still doesn't appear, try logging out and back in.

---

### I forgot my admin password

On the admin login page, tap **"Forgot password?"**, enter your email, and follow the reset link sent to your inbox. If you don't receive the email within a few minutes, check your spam folder.

---

### The admin page isn't loading

- Check your internet connection
- Try refreshing the page
- If the page shows an error with a "Try again" button, tap it
- If the issue persists, log out and log back in

---

### The check-in page isn't working offline

The check-in page can work without an internet connection **only if** you've visited it before on the same device and searched for names while online. If this is your first visit or you're using a different device, an internet connection is required.

---

> **Need more help?**
> Contact your organisation's admin, or reach out to the Rollcally team via the website.
