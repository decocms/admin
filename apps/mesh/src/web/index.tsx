import { createRoot } from 'react-dom/client';
import App from "./app.tsx"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import AuthPage from "./auth/auth-pages.tsx"
import { Providers } from "./providers.tsx"

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Providers>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/auth/:pathname" element={<AuthPage />} />
      </Routes>
    </Providers>
  </BrowserRouter>
)