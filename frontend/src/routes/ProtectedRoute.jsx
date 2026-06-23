import { Navigate, useLocation } from "react-router-dom";

function getUserRole(user) {
  return String(
    user?.RoleName ||
      user?.roleName ||
      user?.Role ||
      user?.role ||
      user?.role_name ||
      "",
  ).toUpperCase();
}

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem("token");

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  const userRole = getUserRole(user);
  const roles = allowedRoles?.map((r) => String(r).toUpperCase());

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles?.length && !roles.includes(userRole)) {
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      return <Navigate to="/admin" replace />;
    }

    if (userRole === "RECEPTIONIST") {
      return <Navigate to="/receptionist" replace />;
    }

    if (userRole === "TECHNICIAN" || userRole === "STYLIST") {
      return <Navigate to="/technician" replace />;
    }

    return <Navigate to="/customer" replace />;
  }

  return children;
}

export default ProtectedRoute;
