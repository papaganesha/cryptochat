import { useLocation } from "preact-iso";
import { useAuth } from "../AuthContext";

export function HeaderCommon() {
  const { url } = useLocation();
  const { logout } = useAuth();

  return (
    <header>
      <nav>
        <a href="/" class={url == "/" && "active"}>
          Home
        </a>
        <a href="/login" class={url == "/login" && "active"}>
          Login
        </a>
        <a href="/register" class={url == "/register" && "active"}>
          Register
        </a>
        <a href="/dashboard" class={url == "/dashboard" && "active"}>
          Dashboard
        </a>
        <a href="/404" class={url == "/404" && "active"}>
          404
        </a>
        <a style={{ cursor: "pointer" }} onClick={logout}>
          Logout
        </a>
      </nav>
    </header>
  );
}

export function HeaderProtected() {
  const { url } = useLocation();

  return (
    <header>
      <nav>
        <a href="/" class={url == "/" && "active"}>
          Home
        </a>
        <a href="/login" class={url == "/login" && "active"}>
          Login
        </a>
        <a href="/register" class={url == "/register" && "active"}>
          Register
        </a>
        <a href="/404" class={url == "/404" && "active"}>
          404
        </a>
      </nav>
    </header>
  );
}
