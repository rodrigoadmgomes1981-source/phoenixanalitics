import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Aceita também as variáveis criadas pela integração Vercel ↔ Supabase (NEXT_PUBLIC_*)
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: { chunkSizeWarningLimit: 900 },
})
