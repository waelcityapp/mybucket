import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[{name:'mock-firebase-preview',enforce:'pre',resolveId(source){if(source==='../../lib/firebase'||source==='../lib/firebase')return '\0mock-firebase-preview';},load(id){if(id==='\0mock-firebase-preview')return 'export const auth = { currentUser: { uid: "mock", getIdToken: async () => "mock" } };';}},react(),tailwindcss()],build:{rollupOptions:{input:'tests/grant-preview/index.html'}},server:{host:'127.0.0.1',port:4178,strictPort:true}});
