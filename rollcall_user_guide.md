# Rollcally: User System Guide & Experience Overview

Welcome to **Rollcally**! This guide explains how the platform works from start to finish — managing your community, tracking attendance, celebrating milestones, and generating reports.

---

## 1. Getting Started: The Setup

Everything in Rollcally starts with an **Organisation** (your community group, church, team, or club).

### Use Case A: For Organisation Creators (Owners)
1. **Register**: Sign up via the Admin Signup page.
2. **Create your Organisation**: Give it a name (e.g., "St. Peter's Bolton"). You are automatically the Org Owner with full authority.
3. **Your Dashboard**: As Org Owner, you have the "Master Key" — full access to all units, members, events, and settings, even those created by other admins.

### Use Case B: Joining an Existing Organisation
1. **Discover**: Use the **Discover** section to search for organisations by name.
2. **Request to Join**: Submit a join request.
3. **Approval**: The Org Owner approves or rejects from their Organisation Dashboard.
4. **Permissions**: Once approved, you can create your own units and manage them. You have **View Only** access to units owned by others unless you are the Org Owner.

---

## 2. The Organisation Dashboard

After joining or creating an organisation, your **Organisation Dashboard** surfaces key analytics at a glance:

| Card | What it shows |
|---|---|
| **Total Members** | Sum of all active members across all units |
| **Active Units** | Number of units in your organisation |
| **Pending Requests** | Join requests awaiting your approval |
| **Sessions (30 days)** | Total events held across all units recently |

Each **unit card** also shows a **member count pill** and a **sessions pill** (last 30 days), so you can compare unit activity without drilling down.

A prominent **"+ New Unit"** button is always visible at the bottom to make it easy to add new departments.

---

## 3. Organising Your Community: Units

Organisations are broken down into **Units**.

- **Examples**: "Youth Group", "Men's Fellowship", "Bible Study Group", "Training Class"

### Use Case: Managing a Unit
- **Distributed Responsibility**: If you create a unit, *you* manage it. The Org Owner maintains full oversight.
- **Unit Dashboard**: Each unit has its own hero dashboard showing the unit name, organisation, your role badge (Org Owner / Command / Observer), upcoming and past sessions, and quick stat pills.

---

## 4. Managing People: Members

Once your Unit is ready, add your people from the **Unit Members** page.

### Use Case: Keeping Records Up-to-Date
- **Individual Entry**: Add members one by one (name, phone, section/group, status, birthday).
- **CSV Import**: Upload a spreadsheet to bulk-add members.
  - **Duplicate Detection**: Rollcally automatically checks for exact and similar names before importing — duplicates are highlighted red (skipped) and similar names are highlighted amber (warned).
  - **Download Template**: Use the built-in template button to get a correctly formatted CSV.
- **Live Search**: Search by name or section — results filter as you type (debounced).
- **Sections & Groups**: The section field is free-text. Members are automatically grouped by section in the list.
- **Status**: Mark members as Active or Retired/Inactive.
- **Pagination**: The roster loads 50 at a time with a "Load more" button.
- **Birthday Tracking**: Add a member's birthday and Rollcally will automatically notify you before and on their special day.

---

## 5. The Main Event: Sessions & Attendance

The heart of Rollcally is tracking who shows up.

### Use Case: Running a Session
1. **Create a Session**: Pick a date and session type (Meeting, Rehearsal, or Sunday Service) from the Unit Dashboard.
2. **The Check-in QR Code**: Rollcally generates a unique link/QR for every session.
3. **Share or Display**: Share the link via WhatsApp/social media, or display the QR on screen at your venue.

### The Meeting Page (Admin View)
When an event is in progress, open it from your Unit Dashboard to see:
- **Attendance QR** — collapsed by default; tap **Expand** to show the live QR code and download it as a PNG.
- **Real-time Stats** — Total members, Present count, Absent count, and Attendance Rate (with a progress bar).
- **Tabs** — All / Present / Absent, each with live counts.
- **Search** — Filter the member list by name within any tab.
- **Member rows** — Each member shows their name, phone, and a **Checked In** (green) or **Absent** (red) badge. Check-in time is shown for present members. You can tap "Call" directly for absent members with a phone number.

### Use Case: The Smart Member Experience (Check-in)
Rollcally is designed for speed:
- **QR Scan**: Members scan the event QR code with their phone camera — no app download needed.
- **Name Selection**: Members pick their name from the list (searchable, grouped by section).
- **One-Tap Confirm**: They tap "Yes, check me in" — done!
- **Result Screen**: A clear success, already-checked-in, or error screen is shown.
- **Security**:
  - **Device Locking**: Each phone is linked to one member per event. You cannot check in for someone else on the same device.
  - **Location Check**: Members must be at the venue to check in. If too far away, the system politely asks them to get closer.
- **Realtime**: The admin dashboard headcount updates live as members check in.

---

## 6. Absence Reports & Exports

On the **Meeting page**, when viewing the **Absent** tab, export buttons appear:

| Format | Best for |
|---|---|
| **TXT** | Simple plain-text printout with a box border |
| **CSV (Excel)** | Spreadsheet with UTF-8 BOM — names with accents render correctly |
| **RTF (Word)** | Formatted table with bold headers, ready for A4 printing |

All exports include: generated date, total absent count, member name, section, and phone number.

---

## 7. Staying Engaged: Notifications & Badges

Rollcally goes beyond data — it's about people.

### Birthday Notifications
- **The Bell Icon**: A notification bell appears on the Unit Dashboard when a member's birthday is today or within the next 7 days.
- **Badge on Member Cards**: On a member's birthday, a 🎂 icon appears next to their name in the roster.
- **Profile Banner**: A full-width celebration card appears at the top of the member's profile page on their birthday.
- **Dismiss**: You can dismiss individual birthday alerts — they'll return next year.

### Role Badges
Rollcally displays your current access level in every header:
- **Org Owner** — full access to everything
- **Command** — full access to your own units
- **Observer** — view-only access

---

## 8. Member Profiles

Tap any member row to view their full profile:
- **Attendance History** — every session listed with Present / Absent / Upcoming badge and check-in time
- **Stat Cards** — Attended count, Total Events, Attendance Rate (colour-coded), and Current Streak
- **Recent Trend** — last 10 events as coloured dots (green = attended, red border = absent)
- **Birthday Banner** — a celebration card shown on birthdays

---

## 9. Summary of Flow

1. **Admin** signs up and creates or joins an **Organisation**.
2. **Units** are created for different departments.
3. **Members** are added (individually or via CSV import).
4. **Sessions** are scheduled from the Unit Dashboard.
5. **Check-in Links / QR Codes** are shared; members check themselves in with one tap.
6. **Attendance** is tracked live with device and location security.
7. **Meeting Page** shows real-time stats and the full member list by status.
8. **Absence Reports** are exported in TXT, CSV, or RTF with one click.
9. **Birthdays** are celebrated automatically with bell notifications and profile banners.

---

## 10. Troubleshooting: Permissions

Rollcally needs **Camera** (for QR scanning, future) and **Location** (to confirm you are at the venue) permissions.

### How to Grant Permission
1. **The Prompt**: When you tap the check-in button, your browser asks: *"Rollcally wants to use your location."*
2. **Tap Allow**.
3. **If you blocked it by mistake**:
   - **On iPhone/Safari**: Tap the **'AA'** icon in the address bar → **Website Settings** → Set Location to **Allow**.
   - **On Android/Chrome**: Tap **Three Dots (⋮)** → **Settings** → **Site Settings** → **Location** → Find Rollcally and tap **Allow**.

---

**Rollcally ensures you spend less time on paperwork and more time building your community.**
