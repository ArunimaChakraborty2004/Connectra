# Connectra (Skillsphere)

A modern developer network and collaboration platform built for showcasing projects, sharing interactive code breakdowns, chatting in real-time groups, and discovering tech teammates with AI.

---

## 👥 Demo Accounts (Seed Developers)

Connectra comes with **11 fully populated developer profiles** featuring diverse tech stacks, syntax-highlighted code posts, interactive polls, custom avatars, and social graphs.

> 🔑 **Default Password for All Demo Accounts:** `abc@123`

| Name | Username | Email (Login ID) | Password | Specialty / Domain |
| :--- | :--- | :--- | :--- | :--- |
| **Alex Rivers** | `@alex_rivers` | `alex@connectra.dev` | `abc@123` | React 19, Server Components, Next.js |
| **Elena Rostova** | `@elena_sec` | `elena@connectra.dev` | `abc@123` | Rust, eBPF Kernel Probes, AppSec |
| **Marcus Vance** | `@marcus_cloud` | `marcus@connectra.dev` | `abc@123` | Kubernetes, Cilium, Terraform, AWS |
| **Sarah Chen** | `@sarah_ai` | `sarah@connectra.dev` | `abc@123` | Python, LangGraph, LLM Agents, PyTorch |
| **Devon Miles** | `@devon_fullstack` | `devon@connectra.dev` | `abc@123` | Supabase Realtime, Next.js 15, PostgreSQL |
| **Priya Sharma** | `@priya_dev` | `priya@connectra.dev` | `abc@123` | Flutter, Dart, 120fps Mobile UX |
| **Kai Takahashi** | `@kai_systems` | `kai@connectra.dev` | `abc@123` | Rust, C++23, Low-Latency Systems, SIMD |
| **Maya Lin** | `@maya_ux` | `maya@connectra.dev` | `abc@123` | Design Systems, CSS Shaders, Three.js |
| **Liam O'Connor** | `@liam_devops` | `liam@connectra.dev` | `abc@123` | SRE, OpenTelemetry, Chaos Engineering |
| **Aisha Al-Mansoor** | `@aisha_web3` | `aisha@connectra.dev` | `abc@123` | Solidity, EVM Internals, Foundry, DeFi |
| **Jordan Blake** | `@jordan_backend` | `jordan@connectra.dev` | `abc@123` | Event-Driven Kafka, Postgres Outbox |

---

## ⚡ Database Seeding Setup

To populate your Supabase database with all 11 developer profiles, their posts, images, polls, comments, and relationships:

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Navigate to **SQL Editor** -> **New Query**.
3. Copy the contents of [`seed_data.sql`](./seed_data.sql) (or Section 8 of [`database_updates.sql`](./database_updates.sql)).
4. Click **Run**.
5. Log in with any of the accounts above using `abc@123`!

---

## 🚀 Key Features

- **Dynamic Social Feed & Stories**:
  - Technical posts with syntax-highlighted code snippets (`javascript`, `python`, `rust`, `solidity`, `sql`, `css`).
  - Interactive polls and high-resolution tech imagery.
  - Instagram-style developer stories bar with gradient rings.
- **AI Copilot & Code Intelligence**:
  - In-feed **AI Code Explanation** and **AI Security Audit** for code snippets.
  - Floating AI Copilot assistant with code generation, copy controls, and session history.
  - **AI Teammate Matchmaker** matching developers to projects based on tech stacks.
- **Enterprise Group Chat & Messaging**:
  - Public & Private channels with invite links and join codes.
  - Admin controls (member removal, pinned announcements).
  - File attachments, code snippets, and real-time messaging.
- **Live Trending Topics**:
  - Real-time aggregation of `#hashtags`, code languages, and developer skills across the platform.
- **Dark & Light Mode**:
  - Global Cyber Dark mode and Warm Cream aesthetic with persistent state.

---

## 🛠️ Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS, Framer Motion, Vanilla CSS tokens
- **State Management**: Zustand
- **Icons**: Lucide React
- **Backend & Database**: Supabase (PostgreSQL, Realtime, Row Level Security, GoTrue Auth)
- **AI Integrations**: Groq & Google Gemini APIs

---

## 🏁 Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GROQ_API_KEY=your_groq_api_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   ```
