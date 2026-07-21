import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import SocialAuthButtons from "../../components/auth/SocialAuthButtons";
import { useAuth } from "../../context/AuthContext";

function redirectByRole(navigate, role) {
  const r = String(role || "").toUpperCase();

  if (r === "ADMIN" || r === "MANAGER") {
    navigate("/admin");
  } else if (r === "RECEPTIONIST") {
    navigate("/receptionist");
  } else if (r === "TECHNICIAN" || r === "STYLIST") {
    navigate("/technician");
  } else if (r === "CUSTOMER") {
    navigate("/customer");
  } else {
    navigate("/");
  }
}

function getRoleFromResponse(data) {
  return (
    data?.user?.RoleName ||
    data?.user?.roleName ||
    data?.user?.Role ||
    data?.user?.role ||
    data?.RoleName ||
    data?.role
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectUrl =
    searchParams.get("redirectUrl") ||
    localStorage.getItem("bookingRedirectUrl");

  const serviceId =
    searchParams.get("serviceId") || localStorage.getItem("bookingServiceId");

  const handleRedirectAfterLogin = (data) => {
    const role = getRoleFromResponse(data);
    const normalizedRole = String(role || "").toUpperCase();

    if (normalizedRole === "CUSTOMER" && redirectUrl) {
      const target = redirectUrl.startsWith("/")
        ? redirectUrl
        : "/customer/booking";

      if (target.includes("/customer/booking")) {
        const url = new URL(target, window.location.origin);

        if (serviceId && !url.searchParams.get("serviceId")) {
          url.searchParams.set("serviceId", serviceId);
        }

        localStorage.removeItem("bookingRedirectUrl");
        localStorage.removeItem("bookingServiceId");

        navigate(`${url.pathname}${url.search}${url.hash}`);
        return;
      }
    }

    localStorage.removeItem("bookingRedirectUrl");
    localStorage.removeItem("bookingServiceId");

    redirectByRole(navigate, role);
  };

  const authenticate = async (credentials) => {
    setError("");
    setSubmitting(true);

    try {
      const res = await axiosClient.post("/auth/login", credentials);
      login(res.data);
      handleRedirectAfterLogin(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Email hoặc mật khẩu chưa đúng.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    await authenticate(form);
  };

  const handleSocialAuthenticated = (data) => {
    login(data);
    handleRedirectAfterLogin(data);
  };

  return (
    <div className="auth-page">
      {/* Background dynamic animated mesh orbs */}
      <div className="auth-bg-decor">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <div className="eyebrow">Welcome back</div>
        <h2>Đăng nhập</h2>

        {error && <p className="auth-error">{error}</p>}

        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          placeholder="Nhập email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value,
            })
          }
        />

        <label htmlFor="login-password">Mật khẩu</label>
        <input
          id="login-password"
          name="password"
          placeholder="Nhập mật khẩu"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) =>
            setForm({
              ...form,
              password: e.target.value,
            })
          }
        />

        <button
          className="btn"
          type="submit"
          disabled={submitting}
          style={{ width: "100%", marginTop: 10 }}
        >
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <div className="auth-links">
          <Link className="see-all" to="/forgot-password">
            Quên mật khẩu?
          </Link>
          <Link className="see-all" to="/verify-email">
            Xác thực email
          </Link>
        </div>

        <div className="auth-divider">
          <span>hoặc tiếp tục với</span>
        </div>

        <SocialAuthButtons
          intent="login"
          onAuthenticated={handleSocialAuthenticated}
          onError={setError}
        />

        <p className="muted">
          Chưa có tài khoản?{" "}
          <Link className="see-all" to="/register">
            Đăng ký ngay
          </Link>
        </p>
      </form>
    </div>
  );
}
