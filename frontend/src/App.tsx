import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Connecting to DeskOps backend...");

  useEffect(() => {
    fetch("http://localhost:5000/health")
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch(() => {
        setMessage("Unable to connect to backend");
      });
  }, []);

  return (
    <div>
      <h1>DeskOps</h1>
      <h2>Service Desk Platform</h2>
      <p>Backend Status: {message}</p>
    </div>
  );
}

export default App;