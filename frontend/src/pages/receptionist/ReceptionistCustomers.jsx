import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
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
      setError(err.response?.data?.message || "Không tải được danh sách khách hàng từ hệ thống");
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
        (x) =>
          String(x.MembershipLevel || "Standard").toLowerCase() === "standard",
      ).length,
      vip: items.filter(
        (x) =>
          String(x.MembershipLevel || "Standard").toLowerCase() !== "standard",
      ).length,
      spent: items.reduce((sum, x) => sum + Number(x.TotalSpent || 0), 0),
      appointments: items.reduce(
        (sum, x) => sum + Number(x.TotalAppointments || 0),
        0,
      ),
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
      setSuccess("Tạo mới hồ sơ khách hàng thành công!");
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tạo hồ sơ khách hàng mới");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ReceptionistLayout>
      <div className="rcc-page">
        <div className="rcc-header">
          <div>
            <h1>Hồ sơ khách hàng</h1>
            <p>
              Quản lý danh sách khách hàng, lịch sử dịch vụ, hóa đơn tích lũy và thẻ thành viên.
            </p>
          </div>

          <button
            className="rcc-primary-btn"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            + Thêm khách hàng mới
          </button>
        </div>

        {error && <div className="rcc-alert error">{error}</div>}
        {success && <div className="rcc-alert success">{success}</div>}

        <div className="rcc-stat-grid">
          <div className="rcc-stat-card pink">
            <span>👥</span>
            <div>
              <p>Tổng số khách hàng</p>
              <b>{stats.total} khách</b>
            </div>
          </div>
          <div className="rcc-stat-card green">
            <span>⭐</span>
            <div>
              <p>Hạng chuẩn (Standard)</p>
              <b>{stats.standard} khách</b>
            </div>
          </div>
          <div className="rcc-stat-card purple">
            <span>💎</span>
            <div>
              <p>Hạng VIP / Thân thiết</p>
              <b>{stats.vip} khách</b>
            </div>
          </div>
          <div className="rcc-stat-card gold">
            <span>💰</span>
            <div>
              <p>Doanh số tích lũy</p>
              <b>{money(stats.spent)}</b>
            </div>
          </div>
        </div>

        <div className="rcc-filter-card">
          <label>
            Tìm kiếm khách hàng nhanh
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Nhập tên khách hàng, số điện thoại hoặc email liên hệ..."
            />
          </label>

          <button
            className="rcc-light-btn"
            type="button"
            onClick={() => setKeyword("")}
          >
            Xóa bộ lọc
          </button>
        </div>

        <div className="rcc-table-card">
          <table className="rcc-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Mã KH</th>
                <th>Thông tin khách hàng</th>
                <th>Liên hệ</th>
                <th>Hạng thành viên</th>
                <th>Điểm tích lũy</th>
                <th>Số lịch hẹn</th>
                <th>Tổng chi tiêu</th>
                <th>Lần ghé gần nhất</th>
                <th style={{ width: "120px" }}>Thao tác</th>
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
                        <small>ID hệ thống: #{c.CustomerId}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <b>{c.Phone || "-"}</b>
                    <small>{c.Email || "-"}</small>
                  </td>

                  <td>
                    <span className={`rcc-badge ${String(c.MembershipLevel || "Standard").toLowerCase() !== "standard" ? "green" : ""}`}>
                      {c.MembershipLevel || "Standard"}
                    </span>
                  </td>

                  <td><b>{c.Points || 0}</b> điểm</td>
                  <td>
                    <b>{c.TotalAppointments || 0}</b> lượt
                    <small>Đã xong: {c.CompletedAppointments || 0}</small>
                  </td>
                  <td><b style={{ color: '#4a7c36' }}>{money(c.TotalSpent)}</b></td>

                  <td>
                    <b>
                      {c.LastVisitDate
                        ? new Date(c.LastVisitDate).toLocaleDateString("vi-VN")
                        : "-"}
                    </b>
                  </td>

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
                  <td colSpan="9" className="rcc-empty">
                    Không tìm thấy dữ liệu khách hàng phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showCreate && (
          <div className="rcc-modal-backdrop">
            <form className="rcc-modal" onSubmit={createCustomer}>
              <h3>Thêm hồ sơ khách hàng</h3>
              <p>Tạo nhanh thông tin khách hàng tại quầy tiếp đón.</p>

              <div className="rcc-form-grid">
                <label>
                  Họ và tên *
                  <input
                    value={form.FullName}
                    placeholder="Nhập họ và tên đầy đủ..."
                    onChange={(e) =>
                      setForm((p) => ({ ...p, FullName: e.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  Số điện thoại liên hệ *
                  <input
                    value={form.Phone}
                    placeholder="Nhập số điện thoại..."
                    onChange={(e) =>
                      setForm((p) => ({ ...p, Phone: e.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  Địa chỉ Email
                  <input
                    type="email"
                    value={form.Email}
                    placeholder="VD: customer@gmail.com..."
                    onChange={(e) =>
                      setForm((p) => ({ ...p, Email: e.target.value }))
                    }
                  />
                </label>

                <label>
                  Giới tính khách hàng
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
                  Ngày sinh nhật
                  <input
                    type="date"
                    value={form.DateOfBirth}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, DateOfBirth: e.target.value }))
                    }
                  />
                </label>

                <label>
                  Địa chỉ thường trú
                  <input
                    value={form.Address}
                    placeholder="Nhập số nhà, tên đường, khu vực..."
                    onChange={(e) =>
                      setForm((p) => ({ ...p, Address: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="rcc-modal-actions">
                <button className="rcc-primary-btn" disabled={loading} type="submit">
                  {loading ? "Đang xử lý..." : "Lưu hồ sơ"}
                </button>
                <button
                  className="rcc-light-btn"
                  type="button"
                  onClick={() => setShowCreate(false)}
                >
                  Đóng lại
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ReceptionistLayout>
  );
}
