# Getting Started - Firebase Setup

## Your Current Status

Project structure: COMPLETE
Authentication code: COMPLETE
UI components: COMPLETE

What's missing: Firebase dependencies and configuration

## What You Need to Do Now

### Option 1: Quick Install (Recommended)

Run this command in your terminal:

npm install --save firebase recharts lucide-react class-variance-authority clsx tailwind-merge zod date-fns react-hook-form @hookform/resolvers

This will install all required packages at once.

### Option 2: Install in Batches

If Option 1 doesn't work, install them one by one:

1. npm install firebase@^10.7.0
2. npm install recharts@^2.10.0 lucide-react@^0.294.0
3. npm install class-variance-authority@^0.7.0 clsx@^2.0.0 tailwind-merge@^2.0.0
4. npm install zod@^3.22.0 date-fns@^2.30.0 react-hook-form@^7.48.0 @hookform/resolvers@^3.3.0

### Option 3: Manual Setup (If npm has issues)

1. Download node_modules from another source
2. Or wait for a better internet connection

## After Installing Dependencies

### Step 1: Setup Firebase Project

1. Go to https://console.firebase.google.com
2. Click 'Add project'
3. Name it: 'khandaq-a-system'
4. Disable Google Analytics (optional)
5. Click 'Create project'

### Step 2: Enable Authentication

1. In Firebase Console, click 'Authentication'
2. Click 'Get started'
3. Go to 'Sign-in method' tab
4. Click 'Email/Password'
5. Toggle 'Enable' to ON
6. Click 'Save'

### Step 3: Create Firestore Database

1. Click 'Firestore Database'
2. Click 'Create database'
3. Select 'Start in test mode'
4. Choose location (closest to you)
5. Click 'Enable'

### Step 4: Get Firebase Config

1. Click the gear icon (Project Settings)
2. Scroll to 'Your apps' section
3. Click '</>' (Web icon)
4. App name: 'khandaq-madresah-web'
5. Click 'Register app'
6. Copy the firebaseConfig values

### Step 5: Configure .env.local

Open .env.local file and update it with your values:

NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD-YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123

### Step 6: Add Security Rules

1. Go to Firestore Database > Rules tab
2. Delete existing rules
3. Copy rules from 'firestore.rules' file in this project
4. Paste into Firebase Console
5. Click 'Publish'

### Step 7: Create First Admin User

1. Open a terminal in the project folder
2. Run: npm run seed:admin
3. This creates (or updates) the master admin login (values come from your .env.local)
4. Run: npm run dev
5. Sign in at http://localhost:3000 with those admin credentials

> There is **no public registration**. All admin/teacher accounts are created by
> an admin from the **Users** page. Existing users can reset their own password
> using the **Forgot password** option on the login page (a reset email is sent).

## Testing the Application

After completing all steps:

1. Start dev server: npm run dev
2. Open: http://localhost:3000
3. Test login
4. Test the "Forgot password" reset flow (a reset email is sent)
5. Test admin dashboard

## Files Created for You

- FIREBASE_SETUP.md - Detailed Firebase setup guide
- firestore.rules - Security rules for Firestore
- INSTALL_INSTRUCTIONS.txt - Installation commands
- GETTING_STARTED.md - This file
- .env.local - Environment variables (needs your Firebase config)

## Need Help?

If npm install is still timing out:

1. Try using a different network
2. Clear npm cache: npm cache clean --force
3. Delete package-lock.json if it exists
4. Try installing one package at a time
5. Use VPN if firewall is blocking npm

## Quick Start Commands

npm install --save firebase recharts lucide-react class-variance-authority clsx tailwind-merge zod date-fns react-hook-form @hookform/resolvers

npm run dev

## Next Steps After Firebase Setup

Once Firebase is configured:
- Test login and the "Forgot password" flow
- Create your first admin with `npm run seed:admin`
- Admins create additional admin/teacher accounts from the Users page
- Then we'll build the admin features (teachers, classes, students management)
