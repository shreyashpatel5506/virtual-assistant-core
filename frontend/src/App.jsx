import "./App.css";
import { Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import PasswordReset from "./pages/passwordReset";
import Customize from "./pages/Customize";
import Customize2 from "./pages/Customize2";
import Home from "./pages/Home";
import History from "./pages/History";
import { Toaster } from "react-hot-toast";

import ProtectedRoute from "./components/ProtectedRoute";
import Cursor from "./components/Cursor";

function App() {
  return (
    <>
      <Cursor />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/passwordreset" element={<PasswordReset />} />

        <Route
          path="/customize"
          element={
            <ProtectedRoute>
              <Customize />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customize2"
          element={
            <ProtectedRoute>
              <Customize2 />
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
      </Routes>

      <Toaster position="top-center" reverseOrder={false} />
    </>
  );
}

export default App;