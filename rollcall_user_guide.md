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
9. [SMS Absence Messaging — Member FAQ](#9-sms-absence-messaging--member-faq)
10. [Billing & Subscriptions](#10-billing--subscriptions)

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

You'll see a green "You're in!" screen with the venue name and your check-in time.

**Optional prompts after check-in:**

If your group leader has set up notifications, you may see one or two optional prompts:

- **"Get instant check-in next time"** — allows your browser to send you a notification when a session starts. Tap **"Enable"** or **"Not now"**.
- **"Stay in the loop"** — if your unit uses SMS absence messaging, you'll be asked whether you'd like to receive a text if you miss a session. Tap **"Yes, that's fine"** to consent or **"No thanks"** to opt out.

Both prompts are **completely optional**. You can skip either without affecting your attendance record. Your choice is saved — you won't be asked again on this device for this unit.

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

### 4.10 SMS Absence Messaging

When a member doesn't check in, Rollcally can automatically send them a friendly text message later that day — if they've consented to receive one.

**Setting it up:**

1. Open any event from the attendance page
2. Scroll to the **"Absence Messaging"** panel at the bottom of the page
3. Toggle the switch to **enable** SMS messaging for your unit
4. Fill in the settings:
   - **Sender name** — what members see as the "From" name (e.g. `GraceChoir`). Max 11 characters, must start with a letter. Leave blank to use the provider's phone number.
   - **Message template** — personalise the text using `{{name}}` (member's name) and `{{event}}` (event type). Example: *"Hi {{name}}, we missed you at {{event}} today. Hope you're well!"*
   - **Auto-send time** — the hour of day when the system sends the messages (noon–9 pm)
   - **Timezone** — your unit's local timezone, so messages go out at the right local time
   - **Cooldown** — minimum days between messages to the same member. Default is 7 days. Setting to 0 sends a message for every missed event (not recommended for active units).
5. Tap **Save** to store your settings
6. To send immediately (without waiting for the scheduled time), tap **"Send to all"**

**Understanding the eligibility count:**

The panel shows a breakdown of absent members:
- **"X will receive SMS"** — members who have consented and have a phone number
- **"X haven't consented"** — members who haven't been asked yet, or haven't responded to the prompt
- **"X have no phone"** — members with no phone number on record

Only the first group will receive a message. Messages are never sent to members who haven't explicitly agreed.

**The delivery log:**

Below the settings, the delivery log shows the status of every message sent for this event:
- **Sent** — delivered successfully
- **Failed** — delivery failed (hover the error snippet to see details — usually a bad phone number format)
- **Skipped** — a concurrent send attempt already claimed this member (safe to ignore)

**Overriding consent for a member:**

Go to **Members**, tap the edit icon on a member, and change the **SMS Consent** field. Options are:
- *Not asked yet* — member won't receive messages until they respond to the check-in prompt
- *Consented — send SMS* — use this to record paper consent (e.g. the member signed a form)
- *Opted out — do not send* — use this if a member has asked you verbally to stop

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

---

## 9. SMS Absence Messaging — Member FAQ

### Will I receive a text message if I miss a session?

Only if **all three** of the following are true:
1. Your unit administrator has enabled SMS messaging
2. You have **consented** — you tapped "Yes, that's fine" on the check-in page after a previous check-in
3. You have a phone number saved in your profile

If you've never been asked, or you tapped "No thanks", you will **not** receive any messages.

---

### Who sends the text message?

The message comes from your unit or organisation — you'll see their sender name (e.g. "GraceChoir") in the "From" field, not "Rollcally". The text itself is written by your unit administrator and will typically include your first name and the name of the event you missed.

---

### How often could I receive messages?

Your unit administrator sets a **cooldown period** — a minimum number of days between messages. The default is 7 days. This means even if you miss multiple events in a row, you'll receive at most one message per week (unless the administrator has chosen a shorter cooldown).

---

### How do I change my mind about SMS?

**To opt out:** The next time you check in, you won't be prompted again — but you can ask your unit administrator to update your preference in your member record. They can set your SMS consent to "Opted out — do not send."

**To consent after previously declining:** Ask your administrator to update your record to "Consented — send SMS."

Rollcally does not currently have a self-service member account where you can change this yourself — it's managed through the administrator.

---

### What if I receive a message in error?

Contact your unit administrator. They can immediately set your SMS preference to "opted out" which prevents any further messages from the next send onwards.

---

### Standard message rates

SMS messages are sent via a third-party provider. Depending on your mobile carrier and plan, standard message rates may apply to messages you receive. Rollcally does not charge you anything to receive messages.

---

## 10. Billing & Subscriptions

This section is for **organisation owners** — the person who created the organisation on Rollcally.

---

### 10.1 Plans

Rollcally offers three monthly subscription plans. Automated follow-ups (absence SMS notifications) are included in every plan:

| Plan | Price | Automated follow-ups included | Extra follow-ups |
|---|---|---|---|
| Starter | $25 / month | 200 | $0.18 each |
| Growth | $59 / month | 600 | $0.15 each |
| Pro | $119 / month | 1,500 | $0.12 each |

**All new subscriptions include a 14-day free trial.** No charge is made until the trial ends. You can cancel any time before that.

Follow-ups are automated absence notifications sent to members who missed a session and have consented to receive them. See [Section 4.12](#412-automated-absence-follow-ups) for how to set them up.

If your organisation sends more follow-ups than your plan includes in a given month, the extras are charged at the per-credit rate shown above. You can see your usage at any time on the Billing page.

---

### 10.2 Accessing the Billing Page

From the Admin Dashboard, tap **"Billing"** in the sidebar (desktop) or bottom navigation (mobile). You'll see your current plan, usage this cycle, and the option to switch plans.

---

### 10.3 Starting a Subscription

1. Go to the Billing page and select a plan
2. You'll be redirected to a secure Stripe checkout page
3. Enter your card details — your 14-day free trial starts immediately
4. Once complete, you'll return to Rollcally and your follow-ups will be active

---

### 10.4 Understanding Your Follow-Up Allowance

Your allowance resets at the start of each billing cycle (the same date each month). Unused follow-ups do not roll over.

The billing page shows how many follow-ups you've used this cycle. You'll see a warning when you're approaching your limit. If you run out, follow-ups are paused — no messages will be sent until your next cycle or until you upgrade.

> **Important:** The limit applies across your entire organisation, not per unit. If you have three units, they all share the same monthly allowance.

---

### 10.5 Upgrading or Downgrading

From the Billing page, select a different plan. If you're upgrading mid-cycle, the extra follow-ups are added to your balance immediately. If you're downgrading, the change takes effect at the next renewal date.

---

### 10.6 Managing Payment & Invoices

Tap **"Manage billing"** on the Billing page. This opens the Stripe Customer Portal where you can:

- Update your card details
- Download past invoices
- Cancel your subscription

Cancellation takes effect at the end of your current billing period — you keep access until then.

---

### 10.7 What Happens If Payment Fails?

Stripe will retry the payment automatically. If it continues to fail:

1. Your subscription will enter **"Payment overdue"** status
2. Automated follow-ups will be paused
3. You'll receive an email from Stripe with a link to update your payment method

Once payment is resolved, your follow-ups resume immediately.

---

### 10.8 Frequently Asked Questions

**Can I have separate plans for different units?**
No — the subscription is per organisation and the allowance is shared across all units. If you run multiple separate organisations on Rollcally (e.g. a church choir and a youth football club), each will need its own subscription.

**Do my follow-ups stop immediately if I cancel?**
No — you keep access until the end of your current billing period. After that, the allowance drops to zero and no more follow-ups are sent.

**I upgraded but my count didn't change — is that normal?**
When you upgrade mid-cycle, the extra credits are added to your existing balance. Your used count stays the same; only the remaining balance increases.

**What counts against my allowance?**
Successfully sent messages and failed delivery attempts both count — in both cases the SMS was submitted to the carrier and a cost was incurred. Blocked sends (when your balance is zero) do not count and are not charged.

**What happens when I run out of included follow-ups mid-month?**
Follow-ups continue sending, but each one beyond your allowance is charged at the extra-credit rate for your plan. You'll see this on your next Stripe invoice. If you prefer to stop at the limit rather than incur overages, contact us and we can configure a hard cap for your account.
