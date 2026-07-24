import { useEffect, useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import axiosClient from "../../api/axiosClient";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const configuredGoogleOrigins = String(
  import.meta.env.VITE_GOOGLE_AUTHORIZED_ORIGINS || "",
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

function getApiError(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function SocialAuthButtons({
  intent = "login",
  onAuthenticated,
  onError,
}) {
  const [activeProvider, setActiveProvider] = useState("");
  const [providerError, setProviderError] = useState("");
  const actionLabel = intent === "register" ? "Đăng ký" : "Đăng nhập";
  const currentOrigin = window.location.origin.replace(/\/$/, "");
  const originIsConfigured = useMemo(
    () =>
      configuredGoogleOrigins.length === 0 ||
      configuredGoogleOrigins.includes(currentOrigin),
    [currentOrigin],
  );

  useEffect(() => {
    const handleScriptError = () => {
      setProviderError(
        "Không tải được Google Identity Services. Hãy kiểm tra kết nối mạng hoặc trình chặn nội dung.",
      );
    };
    window.addEventListener("google-auth:script-error", handleScriptError);
    return () =>
      window.removeEventListener("google-auth:script-error", handleScriptError);
  }, []);

  const authenticateGoogle = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      const message = "Google không trả về thông tin xác thực hợp lệ.";
      setProviderError(message);
      onError?.(message);
      return;
    }

    setActiveProvider("google");
    setProviderError("");
    onError?.("");

    try {
      const response = await axiosClient.post("/auth/google-login", {
        idToken: credentialResponse.credential,
      });
      onAuthenticated(response.data);
    } catch (error) {
      const message = getApiError(
        error,
        `${actionLabel} bằng Google thất bại.`,
      );
      setProviderError(message);
      onError?.(message);
    } finally {
      setActiveProvider("");
    }
  };

  const handleGoogleError = () => {
    const message =
      `${actionLabel} bằng Google không thành công. ` +
      "Hãy cho phép cửa sổ bật lên và kiểm tra Authorized JavaScript origins trong Google Cloud.";
    setProviderError(message);
    onError?.(message);
  };

  return (
    <section className="social-auth" aria-label={`${actionLabel} bằng Google`}>
      {googleClientId && originIsConfigured ? (
        <div
          className={`social-provider social-provider-google${
            activeProvider ? " is-busy" : ""
          }`}
        >
          <GoogleLogin
            onSuccess={authenticateGoogle}
            onError={handleGoogleError}
            text={intent === "register" ? "signup_with" : "signin_with"}
            shape="pill"
            size="large"
            width="400"
            ux_mode="popup"
            context={intent === "register" ? "signup" : "signin"}
          />
        </div>
      ) : (
        <button
          className="social-provider is-unconfigured"
          type="button"
          disabled
        >
          {!googleClientId
            ? "Google chưa được cấu hình"
            : `Google OAuth chưa cho phép origin ${currentOrigin}`}
        </button>
      )}
      {providerError && (
        <p className="social-auth-error" role="alert">
          {providerError}
        </p>
      )}
    </section>
  );
}
