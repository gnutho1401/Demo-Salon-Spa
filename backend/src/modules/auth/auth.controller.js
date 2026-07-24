const authService = require("./auth.service");

async function register(req, res) {
  try {
    res.json(await authService.register(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function verifyEmail(req, res) {
  try {
    res.json(await authService.verifyEmail(req.body.email, req.body.code));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function resendVerifyCode(req, res) {
  try {
    res.json(await authService.resendVerifyCode(req.body.email));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function login(req, res) {
  try {
    res.json(await authService.login(req.body.email, req.body.password));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function googleLogin(req, res) {
  try {
    res.json(await authService.googleLogin(req.body.idToken));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function logout(req, res) {
  res.json({ message: "Đăng xuất thành công" });
}

async function changePassword(req, res) {
  try {
    res.json(
      await authService.changePassword(
        req.user.userId,
        req.body.oldPassword,
        req.body.newPassword,
      ),
    );
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function forgotPassword(req, res) {
  try {
    res.json(await authService.forgotPassword(req.body.email));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function resetPassword(req, res) {
  try {
    res.json(
      await authService.resetPassword(req.body.token, req.body.newPassword),
    );
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = {
  register,
  verifyEmail,
  resendVerifyCode,
  login,
  googleLogin,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
};
