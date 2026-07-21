import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import axiosClient from "../../api/axiosClient";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

function getApiError(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function SocialAuthButtons({
  intent = "login",
  onAuthenticated,
  onError,
}) {
  const [activeProvider, setActiveProvider] = useState("");
  const actionLabel = intent === "register" ? "Đăng ký" : "Đăng nhập";

  const authenticateGoogle = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      onError?.("Google không trả về thông tin xác thực hợp lệ.");
      return;
    }

    setActiveProvider("google");
    onError?.("");

    try {
      const response = await axiosClient.post("/auth/google-login", {
        idToken: credentialResponse.credential,
      });
      onAuthenticated(response.data);
    } catch (error) {
      onError?.(getApiError(error, `${actionLabel} bằng Google thất bại.`));
    } finally {
      setActiveProvider("");
    }
  };

  return (
    <section className="social-auth" aria-label={`${actionLabel} bằng Google`}>
      {googleClientId ? (
        <div
          className={`social-provider social-provider-google${
            activeProvider ? " is-busy" : ""
          }`}
        >
          <GoogleLogin
            onSuccess={authenticateGoogle}
            onError={() =>
              onError?.(`${actionLabel} bằng Google không thành công.`)
            }
            text={intent === "register" ? "signup_with" : "signin_with"}
            shape="pill"
            size="large"
            width="400"
          />
        </div>
      ) : (
        <button
          className="social-provider is-unconfigured"
          type="button"
          disabled
        >
          Google chưa được cấu hình
        </button>
      )}
    </section>
  );
}
