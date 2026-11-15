import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Admin from "./Admin.jsx";
import "./style.css";

const currentPath = window.location.pathname;
const isAdminPage = currentPath === "/admin" || currentPath === "/admin/";
const Root = isAdminPage ? Admin : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
