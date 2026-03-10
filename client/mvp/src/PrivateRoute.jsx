import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export function PrivateRoute({ children }) {
  const { signed, loading } = useAuth();

  if (loading) {
    console.log("Verificando autenticação...");
    return <div>Carregando...</div>; // Importante para não deslogar durante o refresh
  }

  // Se não estiver logado, manda para o login
  if (!signed) {
    console.log("Usuário não autenticado, redirecionando para /login");
    return <Navigate to="/login" replace />;
  }
   
  // Se estiver logado, renderiza o componente filho (Dashboard)
  return children;
}
