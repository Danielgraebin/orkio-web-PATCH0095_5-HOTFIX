import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./routes/Landing.jsx";
import AuthPage from "./routes/AuthPage.jsx";
import AppConsole from "./routes/AppConsole.jsx";
import AdminConsole from "./routes/AdminConsole.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/app" element={<AppConsole />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
