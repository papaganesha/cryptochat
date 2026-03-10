import { createContext } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";

const AuthContext = createContext({
  signed: false,
  user: null,
  loading: true,
  loginHandler: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca na sessionStorage ao iniciar
    const savedUser = sessionStorage.getItem("@App:user");
    const savedToken = sessionStorage.getItem("@App:token");

    if (savedUser && savedToken) {
      console.log("Usuário encontrado na sessionStorage");
      //setUser(JSON.parse(savedUser));
      //console.log(savedUser, JSON.parse(savedUser))
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const loginHandler = (userData, token) => {
    sessionStorage.setItem("@App:user", userData);
    sessionStorage.setItem("@App:token", token);
    setUser(userData);
    window.location.href = "/dashboard"; // Redirecionamento limpo
  };

  const logout = () => {
    console.log("logout");
    sessionStorage.clear();
    setUser(null);
    window.location.href = "/login"; // Redirecionamento limpo
  };

  return (
    <AuthContext.Provider
      value={{ signed: !!user, user, loginHandler, logout, loading }}
    >
      {console.log("User in AuthProvider:", user)}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
