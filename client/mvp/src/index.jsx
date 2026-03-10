import { h, render, hydrate } from "preact"; // Importação correta do hydrate
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { HeaderCommon, HeaderProtected } from "./components/Header.jsx";
import { Home } from "./pages/Home/index.jsx";
import { Login } from "./pages/Login/login.jsx";
import { Register } from "./pages/Register/register.jsx";
import { NotFound } from "./pages/_404.jsx";
import { AuthProvider } from "./AuthContext";
import { PrivateRoute } from "./PrivateRoute";
import { Dashboard } from "./pages/Dashboard/dashboard.jsx";
import "./style.css";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <HeaderCommon />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Inicialização no Navegador
if (typeof window !== "undefined") {
  const root = document.getElementById("app");
  if (root.hasChildNodes()) {
    hydrate(<App />, root);
  } else {
    render(<App />, root);
  }
}

// Função de Prerender CORRETA para Preact
export async function prerender(data) {
  const { default: renderToString } = await import("preact-render-to-string");
  return renderToString(<App {...data} />);
}
