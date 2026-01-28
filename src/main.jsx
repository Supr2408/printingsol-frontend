import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// ✅ Global styles (clean separation)
import "./styles/globals.css";
import "./styles/animations.css";
import "./styles/layout.css";
import "./styles/auth.css";
import "./styles/components.css";
import "./styles/dashboard.css";
import "./styles/modals.css";
import "./styles/editor.css";
import "./styles/utilities.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
