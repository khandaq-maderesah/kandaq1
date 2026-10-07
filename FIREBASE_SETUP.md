# Firebase Setup Guide for Khandaq Madresah Students Management System

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click 'Add project' or 'Create a project'
3. Enter project name: 'khandaq-a-system'
4. Disable Google Analytics (optional, can enable later)
5. Click 'Create project'

## Step 2: Enable Authentication

1. In Firebase Console, go to 'Authentication' (left sidebar)
2. Click 'Get started'
3. Go to 'Sign-in method' tab
4. Click on 'Email/Password'
5. Toggle 'Enable'
6. Click 'Save'

## Step 3: Create Firestore Database

1. Go to 'Firestore Database' (left sidebar)
2. Click 'Create database'
3. Select 'Start in test mode' (we will add security rules later)
4. Choose a location (select closest to you)
5. Click 'Enable'

## Step 4: Get Firebase Configuration

1. Go to Project Settings (gear icon near project name)
2. Scroll down to 'Your apps' section
3. Click '</>' (Web icon) to add a web app
4. Enter app name: 'khandaq-madresah-web'
5. Click 'Register app'
6. Copy the firebaseConfig object values

## Step 5: Configure Environment Variables

Open .env.local file and replace the placeholder values with your actual Firebase config:

NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD-YOUR_ACTUAL_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

## Step 6: Install Dependencies

Run these commands in your terminal:

`ash
npm install firebase@^10.7.0 recharts@^2.10.0 lucide-react@^0.294.0
npm install class-variance-authority@^0.7.0 clsx@^2.0.0 tailwind-merge@^2.0.0
npm install zod@^3.22.0 date-fns@^2.30.0 react-hook-form@^7.48.0 @hookform/resolvers@^3.3.0
`

## Step 7: Firestore Security Rules

Go to Firestore Database > Rules tab and paste these rules:

`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return get(/databases//documents/users/).data.role;
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserRole() == 'admin';
    }
    
    function isTeacher() {
      return isAuthenticated() && getUserRole() == 'teacher';
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow update: if isOwner(userId) && 
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status', 'createdBy']);
      allow create: if isAdmin();
      allow delete: if isAdmin();
    }
    
    match /classes/{classId} {
      allow read: if isAdmin() || 
        (isTeacher() && resource.data.teacherId == request.auth.uid);
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    match /students/{studentId} {
      allow read: if isAdmin() || 
        (isTeacher() && resource.data.classId in get(/databases//documents/users/).data.assignedClassIds);
      allow create: if isAdmin() || 
        (isTeacher() && request.resource.data.classId in get(/databases//documents/users/).data.assignedClassIds);
      allow update, delete: if isAdmin();
    }
    
    match /attendance/{attendanceId} {
      allow read: if isAdmin() || 
        (isTeacher() && resource.data.teacherId == request.auth.uid);
      allow create: if isAdmin() || 
        (isTeacher() && 
         request.resource.data.teacherId == request.auth.uid);
      allow update: if isAdmin() || 
        (isTeacher() && 
         resource.data.teacherId == request.auth.uid);
      allow delete: if false;
    }
    
    match /settings/{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
`

## Step 8: Create First Admin User

There is **no public registration**. Create the first admin with `npm run seed:admin`:

1. Go to Firestore Database
2. Navigate to 'users' collection
3. Find your user document
4. Edit the 'role' field to 'admin'
5. Save

## Verification

After completing all steps:

1. Run: npm run dev
2. Visit: http://localhost:3000
3. Login with your admin credentials
4. Admins create additional accounts from the Users page
5. Existing users reset passwords with "Forgot password"

## Troubleshooting

If you get errors:
- Make sure Firebase config values are correct in .env.local
- Restart dev server after changing .env.local
- Check Firestore is created in test mode or with proper rules
- Ensure Authentication is enabled

