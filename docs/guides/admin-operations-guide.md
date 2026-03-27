# Hyve Portal — Admin Operations Guide

**Version:** 1.0
**Last updated:** 27 March 2026
**For:** Hyve property administrators

---

## Table of Contents

1. [Admin Login](#1-admin-login)
2. [Admin Dashboard](#2-admin-dashboard)
3. [Creating New Members](#3-creating-new-members)
4. [Member Management](#4-member-management)
5. [Document Generation & Signing](#5-document-generation--signing)
6. [Rent Management](#6-rent-management)
7. [Ad-hoc Charges](#7-ad-hoc-charges)
8. [Maintenance Tickets](#8-maintenance-tickets)
9. [Announcements](#9-announcements)
10. [Property Viewings](#10-property-viewings)
11. [Expenses & Import](#11-expenses--import)
12. [Financial Reports](#12-financial-reports)
13. [Smart Locks (TTLock)](#13-smart-locks-ttlock)
14. [Member Data & Compliance](#14-member-data--compliance)

---

## 1. Admin Login

| Field | Value |
|-------|-------|
| **URL** | [hyve.sg/portal/login](https://hyve.sg/portal/login) |
| **Email** | admin@hyve.sg |
| **Password** | Test1234! |

After logging in, you are taken to the **Admin Dashboard** at `/portal/admin`.

> **Security note:** Change the default password after first login. Never share admin credentials over insecure channels.

---

## 2. Admin Dashboard

The admin dashboard (`/portal/admin`) provides:

- **Quick stats** — total members, active, onboarding, vacancies
- **Quick links** — jump to Members, Rent, Documents, Announcements
- **Signature management** — upload and manage your admin signature for counter-signing agreements
- **Recent activity** — latest tickets, payments, and onboarding events

---

## 3. Creating New Members

Navigate to **Members** (`/portal/admin/onboarding`) and click **"New Member"**.

### 4-Step Wizard

#### Step 1: Account

| Field | Description |
|-------|-------------|
| **Username** | The member's login username (cannot be changed later) |
| **Password** | Temporary password — share with the member securely |
| **Property** | Select from Thomson Grove, Chiltern Park, or Ivory Heights |
| **Room** | Select an available room in the chosen property |

#### Step 2: Tenancy

| Field | Description |
|-------|-------------|
| **Monthly Rent** | Rent amount in SGD |
| **Deposit Amount** | Security deposit amount |
| **Move-in Date** | Expected move-in date |
| **Lease Start / End** | Licence agreement period |

#### Step 3: Review TA

Review all the details entered in Steps 1 and 2. Verify that:

- The correct property and room are selected
- Rent and deposit amounts are accurate
- Dates are correct

#### Step 4: Done

The member account is created. The system:

1. Creates a Supabase auth user with the username
2. Creates the `tenant_profiles` record (room, property, rent)
3. Creates the `onboarding_progress` record (status: PERSONAL_DETAILS)
4. Sends a MEMBER_CREATED email notification (if email configured)

> **Next steps:** Share the username and temporary password with the member. They will log in and begin the onboarding flow.

---

## 4. Member Management

### Viewing a Member Profile

1. Go to **Members** (`/portal/admin/onboarding`)
2. Click on any member row to open their detail page (`/portal/admin/onboarding/:id`)

The detail page shows:

- **Profile overview** — name, room, property, rent, status
- **Onboarding progress** — current step with the ability to override any step
- **Personal details** — name, phone, email, nationality, DOB, emergency contact
- **ID documents** — NRIC or passport/work pass photos
- **Credentials** — reset password
- **Charges** — view and create ad-hoc charges
- **Documents** — uploaded and generated documents

### Editing Member Details

From the member detail page:

- Click on editable fields to update tenancy terms (rent, dates, room)
- Personal details are managed by the member during onboarding

### Resetting a Member's Password

1. Open the member detail page
2. Scroll to the **Credentials** section
3. Click **"Reset"**
4. A new temporary password is generated
5. Share the new password with the member

### Overriding Onboarding Steps

If a member needs to skip or redo a step:

1. Open the member detail page
2. Find the **Onboarding Progress** section
3. Click on any step to set it as the current step
4. The member will see that step when they next log in

> **Use case:** Member paid deposit offline — override the deposit step to advance them.

### Offboarding a Member

When a member moves out:

1. Open the member detail page
2. Go to **Member Actions**
3. Initiate **Offboarding**
4. Complete the move-out process:
   - Move-out checklist (compare with move-in checklist)
   - Deposit settlement (deductions for damage, unpaid rent, etc.)
   - Payment clearance (ensure all charges are settled)
5. The member status changes to **Offboarding** then **Archived**

### Archiving a Member

After offboarding is complete, the member is automatically archived. Archived members:

- Cannot log in
- Are hidden from the active members list
- Data is retained for records

### Deleting a Member

> **Warning:** This action is permanent and cannot be undone.

1. Open the member detail page
2. Go to **Member Actions**
3. Click **"Delete Permanently"**
4. Type **"delete"** in the confirmation dialog
5. Confirm

This removes all data: auth user, profile, details, onboarding progress, documents, and charges.

---

## 5. Document Generation & Signing

### Generating a Licence Agreement

1. Go to **Documents** (`/portal/admin/documents`)
2. Click **"Generate Agreement"**
3. Select the member from the dropdown
4. The system generates a filled HTML agreement from the template using the member's tenancy data
5. Use **Cmd+P** (Mac) or **Ctrl+P** (Windows) to **Save as PDF**
6. Save the PDF file locally

> **Note:** The portal uses browser print-to-PDF rather than automated PDF generation for reliability.

### Sending the Agreement to a Member

1. Go to **Documents** (`/portal/admin/documents`)
2. Click **"Send PDF to Member"**
3. Select the member
4. Upload the PDF you saved in the previous step
5. Use the **drag-and-drop signature placer** to position the signature boxes:
   - Place the **member signature** box where the member should sign
   - Place the **admin signature** box where you will counter-sign
6. Click **Send**
7. The member receives a notification that the agreement is ready for signing

### Signing Flow

```
Admin generates agreement
    → Admin saves as PDF
        → Admin uploads PDF + places signature boxes
            → Member signs (draws signature on canvas)
                → Admin counter-signs
                    → Agreement fully executed
```

| Step | Actor | Action |
|------|-------|--------|
| 1 | Admin | Generate agreement HTML |
| 2 | Admin | Print to PDF |
| 3 | Admin | Upload PDF, place signature fields, send |
| 4 | Member | Reviews and signs |
| 5 | Admin | Counter-signs (`/api/portal/counter-sign`) |
| 6 | System | Marks agreement as fully executed |

---

## 6. Rent Management

Navigate to **Rent** (`/portal/admin/rent`).

### Generate Monthly Rent

1. Click **"Generate This Month"**
2. The system creates a `rent_payments` record for each active member with status **PENDING**
3. Members see the rent on their Billing page

> **Tip:** Generate rent at the start of each month (1st).

### Mark Rent as Paid

1. Find the member's rent record in the list
2. Click **Mark Paid**
3. The status changes to **PAID**
4. The member receives a RENT_PAID email notification

### Late Fees

- Rent is due on the **1st of each month**
- After the **5th**, a late fee can be applied
- To add a late fee:
  1. Find the overdue rent record
  2. Click **Add Late Fee**
  3. Enter the fee amount
  4. The late fee is added to the member's balance

### Rent Payment Methods (Member Side)

Members can pay via:

| Method | Fee | Process |
|--------|-----|---------|
| Bank Transfer | None | Transfer to DBS 072-905765-8 (Makery Pte Ltd), upload receipt |
| Stripe (Card) | 4% | Click "Pay Now" on Billing page |

---

## 7. Ad-hoc Charges

Ad-hoc charges are for anything outside regular rent: stamping fees, damage, key replacement, utilities, etc.

### Creating a Charge

1. Go to **Members** → click on a member
2. Scroll to **"Create Charge"**
3. Fill in:

| Field | Description |
|-------|-------------|
| **Description** | What the charge is for (e.g., "Key replacement") |
| **Amount** | Amount in SGD |
| **Category** | Select from: Stamping, Damage, Utilities, Key Replacement, Cleaning, Other |

4. Click **Create**
5. The charge appears on the member's Billing page
6. The member can pay via Stripe (card) through the portal

### Charge Lifecycle

```
Created → Pending → Paid (via Stripe or manually marked)
```

---

## 8. Maintenance Tickets

Members submit maintenance tickets through the portal. Tickets arrive at the admin view.

### Self-Diagnostic System

When a member reports an issue, they select:

- **Category:** AC, Plumbing, Electrical, Furniture, Cleaning, Other
- **Location:** My Room, Kitchen, Living Room, Bathroom (Shared), Corridor, Laundry Area, Other
- **Description:** Free-text description
- **Photos:** Optional image uploads

### Ticket Lifecycle

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
```

| Status | Meaning |
|--------|---------|
| **OPEN** | Newly submitted, awaiting attention |
| **IN_PROGRESS** | Admin is working on the issue or has dispatched a contractor |
| **RESOLVED** | Issue has been fixed |
| **CLOSED** | Ticket closed after resolution confirmed |

### Managing Tickets

1. Go to **Members** or view tickets from the dashboard
2. Click on a ticket to view details, photos, and history
3. Update the status as the issue progresses
4. The member receives a TICKET_STATUS_CHANGED email notification on each update

> **Emergency issues:** Members are instructed to WhatsApp +65 8088 5410 for urgent matters (water leaks, electrical hazards, security).

---

## 9. Announcements

Navigate to **Announcements** (`/portal/admin/announcements`).

### Creating an Announcement

1. Click **"New Announcement"**
2. Fill in:

| Field | Description |
|-------|-------------|
| **Title** | Headline for the announcement |
| **Content** | Full message body |
| **Priority** | Low, Normal, High, Urgent |
| **Property** | Which property this applies to (or all) |

3. Click **"Post"**

### Priority Levels

| Priority | Display |
|----------|---------|
| **Low** | Standard display |
| **Normal** | Default — shown in announcement list |
| **High** | Highlighted in the list |
| **Urgent** | Prominently displayed, may trigger email notification |

### Ticker Display

Active announcements are displayed as a **scrolling ticker banner** at the top of the member's dashboard. Members see the latest announcements every time they log in.

---

## 10. Property Viewings

Navigate to **Viewings** (`/portal/admin/viewings`).

### Creating a Viewing Link

1. Click **"Create Viewing"**
2. Select the property and available room(s)
3. Set the available date/time slots
4. The system generates a **shareable viewing link**

### Sharing via WhatsApp

1. Copy the generated viewing link
2. Share it with prospective tenants via WhatsApp or other messaging apps
3. Prospects can view property details and book a viewing slot through the link

---

## 11. Expenses & Import

Navigate to **Expenses** (`/portal/admin/expenses`).

### Aspire API Integration

The portal can connect to Aspire (business banking) to import transactions:

1. Configure the Aspire API credentials in settings
2. Click **"Import from Aspire"**
3. Transactions are fetched and queued for review

### CSV Upload

For manual expense import:

1. Click **"Import CSV"**
2. Upload a CSV file with transaction data
3. The system parses and displays the transactions for review

### Auto-Tagging

Imported transactions are automatically tagged based on:

- Merchant name matching
- Description keywords
- Historical tagging patterns

### Review Workflow

1. Go to the **Expense Import** page (`/portal/admin/expenses/import`)
2. Review each imported transaction on the **Transaction Review Board**
3. For each transaction:
   - Verify the auto-assigned category
   - Assign to a property if not already matched
   - Approve or reject
4. Approved expenses are recorded in the system

---

## 12. Financial Reports

Navigate to **Financials** (`/portal/admin/financials`).

### Profit & Loss by Property

The financial reports page provides:

- **Monthly P&L** for each property (Thomson Grove, Chiltern Park, Ivory Heights)
- **Revenue breakdown:** rent collected, ad-hoc charges
- **Expense breakdown:** by category (maintenance, utilities, cleaning, etc.)
- **Net income** per property per month

Use the date filters to view different periods.

---

## 13. Smart Locks (TTLock)

Navigate to **Smart Locks** (`/portal/admin/locks`).

> **Current status:** TTLock integration is configured in the system but awaiting account creation. The following features will be available once active.

### Planned Features

| Feature | Description |
|---------|-------------|
| **Generate passcodes** | Create time-limited door codes for members |
| **Revoke passcodes** | Disable codes for moved-out members |
| **Temporary access** | Generate one-time codes for viewings or contractors |
| **Lock status** | View battery level and lock status |

### Configuration

The TTLock integration uses these environment variables:

- `TTLOCK_CLIENT_ID`
- `TTLOCK_CLIENT_SECRET`
- `TTLOCK_USERNAME`
- `TTLOCK_PASSWORD_MD5`

Admin actions related to TTLock are handled through the `/api/portal/admin-actions` endpoint.

---

## 14. Member Data & Compliance

### Profile Viewing

From any member's detail page, you can view:

- Full name, nationality, date of birth
- Phone number (with country code)
- Email address
- Emergency contact details
- Room assignment and property
- Monthly rent and deposit

### ID Document Photos

Member-uploaded identity documents are stored in Supabase Storage:

- **Singaporeans:** NRIC front and back photos
- **Foreigners:** Passport photo page + work pass / employment pass

Access these from the member detail page under the ID verification section.

### Pass Expiry Tracking

For foreign members with work passes or employment passes:

- The **expiry date** is recorded during onboarding
- The system sends a **PASS_EXPIRING** email notification when the pass is nearing expiry
- Admin can view all upcoming pass expiries from the member list
- Members should update their pass information in the portal when they renew

> **Compliance note:** Ensure all foreign members have valid passes at all times. Follow up promptly on expiry notifications.

---

## Quick Reference — Admin Paths

| Page | URL Path |
|------|----------|
| Admin Dashboard | `/portal/admin` |
| Members | `/portal/admin/onboarding` |
| Member Detail | `/portal/admin/onboarding/:id` |
| Rent | `/portal/admin/rent` |
| Documents | `/portal/admin/documents` |
| Announcements | `/portal/admin/announcements` |
| Tasks | `/portal/admin/tasks` |
| Expenses | `/portal/admin/expenses` |
| Expense Import | `/portal/admin/expenses/import` |
| Financials | `/portal/admin/financials` |
| Smart Locks | `/portal/admin/locks` |
| Devices | `/portal/admin/devices` |
| Viewings | `/portal/admin/viewings` |

---

## Email Notifications Sent by the System

| Event | When |
|-------|------|
| MEMBER_CREATED | New member account created |
| TA_READY | Agreement sent to member for signing |
| TA_COUNTER_SIGNED | Admin counter-signs agreement |
| DEPOSIT_VERIFIED | Admin verifies deposit payment |
| ONBOARDING_COMPLETE | Member finishes all onboarding steps |
| TICKET_STATUS_CHANGED | Maintenance ticket status updated |
| RENT_OVERDUE | Rent past due date |
| RENT_PAID | Rent payment confirmed |
| ANNOUNCEMENT | New announcement posted |
| PASS_EXPIRING | Foreign member's pass nearing expiry |
| AC_THRESHOLD_WARNING | Member approaching AC usage limit |

---

## Technical Notes

- **Vercel Hobby plan:** Maximum 12 serverless functions (currently at limit — do not add new API routes without removing one)
- **Database:** Supabase (project: diiilqpfmlxjwiaeophb)
- **Payments:** Stripe (live keys in production, test keys in preview/staging)
- **Emails:** Sent via Supabase Edge Function + Resend API
- **Branches:** `master` = production (hyve.sg), `staging` = development/testing

---

*For technical support, contact the development team or refer to the codebase at `/Users/mark/Desktop/hyve-website`.*
