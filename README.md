# Connectra (Skillsphere)

A modern web application built for connecting developers, sharing projects, and collaborating.

## Tech Stack

- **Frontend Framework**: React 19 + Vite
- **Styling**: Tailwind CSS, Framer Motion for animations
- **State Management**: Zustand
- **Routing**: React Router
- **Icons**: Lucide React
- **Backend & Database**: Supabase

## Features

- **Authentication**: Secure user login and registration using Supabase Auth.
- **Interactive Dashboard**: A personalized dashboard for users to view their activity and stats.
- **Social Feed**: A dynamic feed to see updates, posts, and activities from other users.
- **Project Management**: Create, view, and manage projects through a dedicated modal interface.
- **Responsive Layout**: A modern UI with a responsive Sidebar and Rightbar for seamless navigation.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the Development Server**
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`: Starts the Vite development server.
- `npm run build`: Builds the app for production.
- `npm run lint`: Runs ESLint to check for code issues.
- `npm run preview`: Previews the production build locally.
