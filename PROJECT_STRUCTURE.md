# Project Structure

## Completed Setup

? Next.js 15 initialized with App Router
? TypeScript configured
? Tailwind CSS configured
? Project structure created
? Type definitions for all entities
? Firebase configuration structure
? Utility functions (cn helper)
? Environment variables template
? Configuration files (tsconfig, tailwind, postcss, next, eslint)

## Directory Structure

```
ansar-madresah-attendance/
+-- .env.local                    # Environment variables (Firebase config)
+-- .gitignore                    # Git ignore rules
+-- eslint.config.mjs             # ESLint configuration
+-- next.config.ts                # Next.js configuration
+-- next-env.d.ts                 # Next.js type definitions
+-- package.json                  # Dependencies and scripts
+-- postcss.config.mjs            # PostCSS configuration
+-- tailwind.config.ts            # Tailwind CSS configuration
+-- tsconfig.json                 # TypeScript configuration
+-- README.md                     # Project documentation
+-- PROJECT_STRUCTURE.md          # This file
¦
+-- public/                       # Static assets (images, icons, etc.)
¦
+-- src/
    +-- app/                      # Next.js App Router
    ¦   +-- globals.css           # Global styles
    ¦   +-- layout.tsx            # Root layout
    ¦   +-- page.tsx              # Home page
    ¦
    +-- components/               # React components (to be created)
    ¦   +-- ui/                   # Shadcn UI components
    ¦   +-- forms/                # Form components
    ¦   +-- charts/               # Recharts components
    ¦   +-- layout/               # Layout components
    ¦
    +-- lib/                      # Utilities and configurations
    ¦   +-- utils.ts              # Helper functions (cn, etc.)
    ¦   +-- firebase/
    ¦   ¦   +-- config.ts         # Firebase initialization
    ¦   +-- hooks/                # Custom React hooks (to be created)
    ¦   +-- services/             # API services (to be created)
    ¦
    +-- types/                    # TypeScript definitions
        +-- index.ts              # All TypeScript interfaces
```

## Type Definitions Created

### User
- Admin/Teacher roles
- Status tracking
- Assigned classes for teachers

### Class
- Teacher assignment
- Grade/Section/Academic year
- Student count (denormalized)

### Student
- Parent contact info
- Class assignment
- Personal details

### Attendance
- Date tracking (YYYY-MM-DD)
- Status (present/absent/late)
- Marking audit trail

## Next Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up Firebase
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Create Firestore Database
4. Copy configuration to `.env.local`

### Step 3: Install Additional Packages
```bash
npm install firebase recharts lucide-react class-variance-authority clsx tailwind-merge zod date-fns react-hook-form @hookform/resolvers
npm install -D @types/node @types/react @types/react-dom autoprefixer postcss tailwindcss eslint eslint-config-next typescript
```

### Step 4: Set Up Shadcn UI
```bash
npx shadcn@latest init
```

### Step 5: Create Firestore Security Rules
(Will be provided in next step)

## Current Package Versions

- Next.js: 16.3.0
- React: 19.2.8
- TypeScript: 5.x
- Tailwind CSS: 4.x

## Notes

- The project uses Next.js 15+ with App Router
- Firebase client SDK will be used for browser operations
- Server Components will be used where possible for performance
- Type safety is enforced throughout the application
