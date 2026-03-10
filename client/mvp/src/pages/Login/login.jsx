import preactLogo from "../../assets/preact.svg";
import "./style.css";
import { createElement } from "preact";
import { useState } from "react";
import { useAuth } from "../../AuthContext";
import api from "../../services/api.js";

export function Login() {
  // 1. Criar o estado para o input
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Estados para feedback visual
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { loginHandler, loading } = useAuth();


  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(""); // Limpa erros anteriores

    try {
      const response = await api.post('/auth/login', { username, password });
      
      // Assume que seu backend retorna { user: {...}, token: "..." }
      const { token } = response.data;
      console.log("user: response.data")
      loginHandler( username, token );
    } catch (error) {
      setErrorMsg('Falha no login: ' + (error.response?.data?.message || 'Erro no servidor'));
      setIsLoading(false);
    }
  }
  
  return (
    <div>
      <h2 class="big">Login</h2>
	  <p>{errorMsg}</p>
        <form action="" onSubmit={handleLogin}>
        <input
          value={username}
          onInput={(e) => {
            setUsername(e.target.value);
          }}
          id="username"
          type="text"
          placeholder={"Username"}
        />
		<br></br><br />
        <input
          value={password}
          onInput={(e) => {
            setPassword(e.target.value);
          }}
          id="password"
          type="text"
          placeholder={"Password"}
        />
	  <br />
      <button
      >
         {isLoading ? "..." : "Logar"}
      </button>
      </form>
    </div>
    
  );
}


