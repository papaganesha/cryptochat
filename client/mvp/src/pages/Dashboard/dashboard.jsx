import preactLogo from "../../assets/preact.svg";
import "./style.css";
import { useAuth } from "../../AuthContext";

export function Dashboard() {
  const { user } = useAuth();
  console.log("user:", user);
  return (
    <div class="home">
      <h1>Hello {user}</h1>
    </div>
  );
}
