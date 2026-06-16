import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}
function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

export default function ReceptionistCustomers() {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    FullName: "",
    Phone: "",
    Email: "",
    Gender: "",
    DateOfBirth: "",
    Address: "",
  });

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get("/receptionist/customers", {
        params: { keyword },
      });
      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được khách hàng");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      standard: items.filter(
        (x) => String(x.MembershipLevel || "").toLowerCase() === "standard",
      ).length,
      vip: items.filter(
        (x) => String(x.MembershipLevel || "").toLowerCase() !== "standard",
      ).length,
      spent: items.reduce((sum, x) => sum + Number(x.TotalSpent || 0), 0),
    };
  }, [items]);

  async function createCustomer(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await axiosClient.post("/receptionist/customers", form);

      setShowCreate(false);
      setForm({
        FullName: "",
        Phone: "",
        Email: "",
        Gender: "",
        DateOfBirth: "",
        Address: "",
      });

      await load();
      setSuccess("Đã tạo khách hàng mới thành công");
    } catch (err) {
      setError(err.response?.data?.message || "Tạo khách hàng thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ReceptionistLayout>
      <div className="rcc-page">
        <div className="rcc-header">
          <div>
            <h1>Khách hàng</h1>
            <p>
              Quản lý hồ sơ khách hàng, lịch sử đặt lịch, thanh toán và
              membership.
            </p>
          </div>

          <button
            className="rcc-primary-btn"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            + Thêm khách hàng
          </button>
        </div>

        {error && <div className="rcc-alert error">{error}</div>}
        {success && <div className="rcc-alert success">{success}</div>}

        <div className="rcc-stat-grid">
          <div className="rcc-stat-card pink">
            <span>👥</span>
            <p>Tổng khách hàng</p>
            <b>{stats.total}</b>
          </div>
          <div className="rcc-stat-card green">
            <span>⭐</span>
            <p>Standard</p>
            <b>{stats.standard}</b>
          </div>
          <div className="rcc-stat-card purple">
            <span>💎</span>
            <p>VIP / Member</p>
            <b>{stats.vip}</b>
          </div>
          <div className="rcc-stat-card gold">
            <span>💰</span>
            <p>Tổng chi tiêu</p>
            <b>{money(stats.spent)}</b>
          </div>
        </div>

        <div className="rcc-filter-card">
          <label>
            Tìm khách hàng
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Nhập tên, số điện thoại hoặc email..."
            />
          </label>

          <button
            className="rcc-light-btn"
            type="button"
            onClick={() => setKeyword("")}
          >
            Đặt lại
          </button>
        </div>

        <div className="rcc-table-card">
          <table className="rcc-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Khách hàng</th>
                <th>Liên hệ</th>
                <th>Membership</th>
                <th>Điểm</th>
                <th>Lịch hẹn</th>
                <th>Chi tiêu</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {items.map((c) => (
                <tr key={c.CustomerId}>
                  <td>#{c.CustomerId}</td>

                  <td>
                    <div className="rcc-user-cell">
                      <img
                        className="rcc-avatar"
                        src={avatarUrl(c.AvatarUrl)}
                        alt={c.FullName || "Customer"}
                      />
                      <div>
                        <b>{c.FullName}</b>
                        <small>Customer ID #{c.CustomerId}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <b>{c.Phone || "-"}</b>
                    <small>{c.Email || "-"}</small>
                  </td>

                  <td>
                    <span className="rcc-badge">
                      {c.MembershipLevel || "Standard"}
                    </span>
                  </td>

                  <td>{c.Points || 0}</td>
                  <td>{c.TotalAppointments || 0}</td>
                  <td>{money(c.TotalSpent)}</td>

                  <td>
                    <Link
                      className="rcc-icon-btn"
                      to={`/receptionist/customers/${c.CustomerId}`}
                    >
                      Xem chi tiết
                    </Link>
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="8" className="rcc-empty">
                    Không có khách hàng phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showCreate && (
          <div className="rcc-modal-backdrop">
            <form className="rcc-modal" onSubmit={createCustomer}>
              <h3>Thêm khách hàng mới</h3>
              <p>Tạo nhanh hồ sơ khách tại quầy lễ tân.</p>

              <div className="rcc-form-grid">
                <label>
                  Họ tên *
                  <input
                    value={form.FullName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, FullName: e.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  Số điện thoại *
                  <input
                    value={form.Phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, Phone: e.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={form.Email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, Email: e.target.value }))
                    }
                  />
                </label>

                <label>
                  Giới tính
                  <select
                    value={form.Gender}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, Gender: e.target.value }))
                    }
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="Female">Nữ</option>
                    <option value="Male">Nam</option>
                    <option value="Other">Khác</option>
                  </select>
                </label>

                <label>
                  Ngày sinh
                  <input
                    type="date"
                    value={form.DateOfBirth}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, DateOfBirth: e.target.value }))
                    }
                  />
                </label>

                <label>
                  Địa chỉ
                  <input
                    value={form.Address}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, Address: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="rcc-modal-actions">
                <button className="rcc-primary-btn" disabled={loading}>
                  {loading ? "Đang lưu..." : "Tạo khách hàng"}
                </button>
                <button
                  className="rcc-light-btn"
                  type="button"
                  onClick={() => setShowCreate(false)}
                >
                  Đóng
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ReceptionistLayout>
  );
}
