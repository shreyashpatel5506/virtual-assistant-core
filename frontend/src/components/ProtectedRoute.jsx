import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../Context/usercontext";

function ProtectedRoute({ children }) {
    const { users } = useContext(UserContext);

    if (!users) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;