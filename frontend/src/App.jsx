import './App.css'
import { Routes, Route } from 'react-router-dom'
import Signup from './pages/Signup'
import Login from './pages/Login'
import PasswordReset from './pages/passwordReset'
import { useContext, useState, useEffect } from 'react'
import { UserContext } from './Context/usercontext' // ✅ import context, not provider
import Customize from './pages/Customize'
import React from 'react'
import Home from './pages/Home.jsx'
import toast, { Toaster } from 'react-hot-toast';
import Customize2 from './pages/Customize2'
import History from './pages/History'
import { Navigate } from "react-router-dom";
function App() {
  const { users, setUsers } = useContext(UserContext); // ✅ use UserContext
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

const ProtectedRoute = ({ children }) => {
  const { users } = useContext(UserContext);

  if (!users) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

  return (
    <>
      <div
        className="pointer-events-none fixed z-50 w-10 h-10 rounded-full border-2 border-cyan-300 shadow-[0_0_20px_rgba(0,255,255,0.6)]"
        style={{
          left: cursor.x - 20,
          top: cursor.y - 20,
        }}
      ></div>

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
  )
}

export default App
