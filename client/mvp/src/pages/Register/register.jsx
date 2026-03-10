import preactLogo from "../../assets/preact.svg";
import "./style.css";
import { createElement } from "preact";
import React, { useState, useEffect } from "react";

export function Register() {
  // 1. Criar o estado para o input
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // Estados para feedback visual
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function limparCampos() {
      setUsername("");
      setPassword("");
      setConfirmPass("")
  }

  async function handleLogin(e){
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(""); // Limpa erros anteriores
    try {
      // 1. Enviando o pacote (POST)
      const response = await fetch("http://localhost:3000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
       const data = await response.json();
      
      // 2. Verificando se a resposta foi positiva
      if (!response.ok) {
        console.log(data.error)
        setErrorMsg(data.error)
      }else{

      // 3. Recebendo e tratando o pacote de sucesso (ex: Token)
      console.log("Sucesso:", data);
      setErrorMsg(data.msg)
      localStorage.setItem("token", data.token); // Exemplo comum de salvamento
      
      // Limpar campos após sucesso
      limparCampos()
      alert("Registro realizado com sucesso!");
      }



     
    } catch (err) {
      // 4. Tratando erros (rede ou credenciais inválidas)
      setErrorMsg(err.error);
    } finally {
      setIsLoading(false);
    }
  }

 useEffect(() => {
    // Set a timer to clear the message after 5000 milliseconds (5 seconds)
    const timerId = setTimeout(() => {
      setErrorMsg(""); // Clear the message (set to null or an empty string)
    }, 5000);

    // Cleanup function to clear the timeout if the component unmounts
    // or if the message dependency changes before the timeout completes
    return () => {
      clearTimeout(timerId);
    };
  }, [errorMsg]); 

  return (
    <div>
      <h2 class="big">Register</h2>
      <p>{errorMsg}</p>
      <div>
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
        <br /><br />
                <input
          value={confirmPass}
          onInput={(e) => {
            setConfirmPass(e.target.value);
          }}
          id="confirmPass"
          type="text"
          placeholder={"Confirm password"}
          
        />
      </div>
	  <br />
      <button
        onClick={handleLogin}
      >
         {isLoading ? "..." : "Logar"}
      </button>
    </div>
  );
}

function Resource(props) {
  return (
    <a href={props.href} target="_blank" class="resource">
      <h2>{props.title}</h2>
      <p>{props.description}</p>
    </a>
  );
}
