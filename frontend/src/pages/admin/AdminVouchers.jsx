import { useEffect, useMemo, useState } from "react";
import axiosClient from "../../api/axiosClient";

const emptyForm = {
  Code: "",
  DiscountType: "PERCENT",
  DiscountValue: "",
  MinOrderAmount: "",
  MaxDiscountAmount: "",
  StartDate: "",
  EndDate: "",
  Quantity: "",
  Status: "ACTIVE",
};

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function discountText(item) {
  if (item.DiscountType === "PERCENT")
    return `${Number(item.DiscountValue || 0)}%`;
  return money(item.DiscountValue);
}

export default function AdminVouchers() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    discountType: "",
    status: "",
    fromDate: "",
    toDate: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setLoading(true);

      const res = await axiosClient.get("/admin/vouchers", {
        params: {
          keyword: filters.keyword || undefined,
          discountType: filters.discountType || undefined,
          status: filters.status || undefined,
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        },
      });

      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách voucher",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((x) => x.Status === "ACTIVE").length,
      running: items.filter((x) => x.RuntimeStatus === "RUNNING").length,
      expired: items.filter((x) => x.RuntimeStatus === "EXPIRED").length,
      used: items.reduce((sum, x) => sum + Number(x.UsedCount || 0), 0),
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(item) {
    setEditingId(item.VoucherId);
    setForm({
      Code: item.Code || "",
      DiscountType: item.DiscountType || "PERCENT",
      DiscountValue: String(item.DiscountValue ?? ""),
      MinOrderAmount: String(item.MinOrderAmount ?? ""),
      MaxDiscountAmount:
        item.MaxDiscountAmount === null
          ? ""
          : String(item.MaxDiscountAmount ?? ""),
      StartDate: item.StartDate ? String(item.StartDate).slice(0, 10) : "",
      EndDate: item.EndDate ? String(item.EndDate).slice(0, 10) : "",
      Quantity: String(item.Quantity ?? ""),
      Status: item.Status || "ACTIVE",
    });
    setError("");
    setShowModal(true);
  }

  function validate() {
    if (!form.Code.trim()) throw new Error("Vui lòng nhập mã voucher");

    const value = Number(form.DiscountValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Giá trị giảm giá phải lớn hơn 0");
    }

    if (form.DiscountType === "PERCENT" && value > 100) {
      throw new Error("Voucher phần trăm phải từ 1 đến 100");
    }

    if (Number(form.MinOrderAmount || 0) < 0) {
      throw new Error("Đơn tối thiểu không hợp lệ");
    }

    if (form.MaxDiscountAmount !== "" && Number(form.MaxDiscountAmount) < 0) {
      throw new Error("Giảm tối đa không hợp lệ");
    }

    if (!form.StartDate) throw new Error("Vui lòng chọn ngày bắt đầu");
    if (!form.EndDate) throw new Error("Vui lòng chọn ngày kết thúc");

    if (new Date(form.StartDate) > new Date(form.EndDate)) {
      throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
    }

    if (Number(form.Quantity || 0) < 0) {
      throw new Error("Số lượng không hợp lệ");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const payload = {
        Code: form.Code.trim().toUpperCase(),
        DiscountType: form.DiscountType,
        DiscountValue: Number(form.DiscountValue),
        MinOrderAmount: Number(form.MinOrderAmount || 0),
        MaxDiscountAmount:
          form.MaxDiscountAmount === "" ? null : Number(form.MaxDiscountAmount),
        StartDate: form.StartDate,
        EndDate: form.EndDate,
        Quantity: Number(form.Quantity || 0),
        Status: form.Status,
      };

      if (editingId) {
        await axiosClient.put(`/admin/vouchers/${editingId}`, payload);
      } else {
        await axiosClient.post("/admin/vouchers", payload);
      }

      setShowModal(false);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu voucher thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    const ok = window.confirm(
      `Bạn muốn đổi trạng thái voucher "${item.Code}" thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/vouchers/${item.VoucherId}/status`, {
        status: nextStatus,
      });
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  async function remove(item) {
    const ok = window.confirm(`Bạn chắc chắn muốn xóa voucher "${item.Code}"?`);
    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/vouchers/${item.VoucherId}`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa voucher thất bại",
      );
    }
  }

  function clearFilters() {
    setFilters({
      keyword: "",
      discountType: "",
      status: "",
      fromDate: "",
      toDate: "",
    });
  }

  return (
    <section className="admin-page admin-vouchers-page">
      <div className="admin-vouchers-hero">
        <div>
          <div className="admin-eyebrow">Vouchers Management</div>
          <h1>Quản lý voucher</h1>
          <p>
            Quản lý mã giảm giá, loại giảm, điều kiện đơn tối thiểu, giới hạn sử
            dụng, thời hạn và trạng thái voucher.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm voucher
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">🎟</div>
          <div>
            <p>Tổng voucher</p>
            <h3>{stats.total}</h3>
            <span>Tất cả mã giảm giá</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang active</p>
            <h3>{stats.active}</h3>
            <span>Status ACTIVE</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🔥</div>
          <div>
            <p>Đang chạy</p>
            <h3>{stats.running}</h3>
            <span>Còn hạn và còn lượt</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🧾</div>
          <div>
            <p>Đã sử dụng</p>
            <h3>{stats.used}</h3>
            <span>Tổng lượt dùng voucher</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-vouchers-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm mã voucher..."
        />

        <select
          value={filters.discountType}
          onChange={(e) =>
            setFilters({ ...filters, discountType: e.target.value })
          }
        >
          <option value="">Tất cả loại</option>
          <option value="PERCENT">PERCENT</option>
          <option value="AMOUNT">AMOUNT</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
        />

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>

        <button className="card-btn" onClick={clearFilters}>
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải danh sách voucher...</div>
      ) : null}

      {!loading ? (
        <div className="admin-vouchers-grid">
          {items.map((item) => (
            <article className="admin-voucher-card" key={item.VoucherId}>
              <div className="admin-voucher-ticket">
                <div>
                  <span>VOUCHER</span>
                  <h3>{item.Code}</h3>
                </div>

                <strong>{discountText(item)}</strong>
              </div>

              <div className="admin-voucher-body">
                <div className="admin-voucher-status-line">
                  <span
                    className={statusClass(item.RuntimeStatus || item.Status)}
                  >
                    {item.RuntimeStatus || item.Status}
                  </span>
                  <span className={statusClass(item.Status)}>
                    {item.Status}
                  </span>
                </div>

                <div className="admin-voucher-date">
                  <strong>{dateText(item.StartDate)}</strong>
                  <span>→</span>
                  <strong>{dateText(item.EndDate)}</strong>
                </div>

                <div className="admin-voucher-info">
                  <div>
                    <span>Đơn tối thiểu</span>
                    <strong>{money(item.MinOrderAmount)}</strong>
                  </div>
                  <div>
                    <span>Giảm tối đa</span>
                    <strong>
                      {item.MaxDiscountAmount === null
                        ? "Không giới hạn"
                        : money(item.MaxDiscountAmount)}
                    </strong>
                  </div>
                  <div>
                    <span>Số lượng</span>
                    <strong>{item.Quantity || 0}</strong>
                  </div>
                  <div>
                    <span>Đã dùng / Còn</span>
                    <strong>
                      {item.UsedCount || 0} / {item.RemainingQuantity || 0}
                    </strong>
                  </div>
                </div>

                <div className="admin-card-actions">
                  <button
                    className="card-btn"
                    onClick={() => setSelected(item)}
                  >
                    Chi tiết
                  </button>

                  <button
                    className="card-btn primary"
                    onClick={() => openEdit(item)}
                  >
                    Sửa
                  </button>

                  {item.Status === "ACTIVE" ? (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "INACTIVE")}
                    >
                      Tắt
                    </button>
                  ) : (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "ACTIVE")}
                    >
                      Bật
                    </button>
                  )}

                  <button
                    className="card-btn danger"
                    onClick={() => remove(item)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có voucher phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-voucher-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div className="admin-voucher-ticket detail">
              <div>
                <span>VOUCHER CODE</span>
                <h3>{selected.Code}</h3>
              </div>
              <strong>{discountText(selected)}</strong>
            </div>

            <div className="admin-detail-grid">
              <p>
                <strong>Loại giảm:</strong> {selected.DiscountType}
              </p>
              <p>
                <strong>Giá trị:</strong> {discountText(selected)}
              </p>
              <p>
                <strong>Đơn tối thiểu:</strong> {money(selected.MinOrderAmount)}
              </p>
              <p>
                <strong>Giảm tối đa:</strong>{" "}
                {selected.MaxDiscountAmount === null
                  ? "Không giới hạn"
                  : money(selected.MaxDiscountAmount)}
              </p>
              <p>
                <strong>Bắt đầu:</strong> {dateText(selected.StartDate)}
              </p>
              <p>
                <strong>Kết thúc:</strong> {dateText(selected.EndDate)}
              </p>
              <p>
                <strong>Số lượng:</strong> {selected.Quantity || 0}
              </p>
              <p>
                <strong>Đã dùng:</strong> {selected.UsedCount || 0}
              </p>
              <p>
                <strong>Còn lại:</strong> {selected.RemainingQuantity || 0}
              </p>
              <p>
                <strong>Khách đã nhận:</strong> {selected.CustomerCount || 0}
              </p>
              <p>
                <strong>Trạng thái:</strong> {selected.Status}
              </p>
              <p>
                <strong>Runtime:</strong> {selected.RuntimeStatus}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-voucher-form luxury-voucher-editor"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-modal-close"
              onClick={() => setShowModal(false)}
            >
              ×
            </button>

            <div className="voucher-editor-head">
              <div>
                <span>{editingId ? "Edit Voucher" : "Create Voucher"}</span>
                <h3>{editingId ? "Sửa voucher" : "Thêm voucher mới"}</h3>
                <p>
                  Cấu hình mã giảm giá, điều kiện sử dụng, số lượng và thời hạn
                  áp dụng.
                </p>
              </div>

              <div className="voucher-preview-ticket">
                <small>LIVE PREVIEW</small>
                <strong>{form.Code || "BEAUTY20"}</strong>
                <b>
                  {form.DiscountType === "PERCENT"
                    ? `${form.DiscountValue || 20}%`
                    : money(form.DiscountValue || 50000)}
                </b>
              </div>
            </div>

            <div className="voucher-editor-layout">
              <div className="voucher-editor-main">
                <div className="voucher-section-title">
                  <span>01</span>
                  <div>
                    <h4>Thông tin voucher</h4>
                    <p>Nhập mã và loại giảm giá.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Mã voucher *
                    <input
                      value={form.Code}
                      onChange={(e) =>
                        setForm({ ...form, Code: e.target.value.toUpperCase() })
                      }
                      placeholder="BEAUTY20"
                      required
                    />
                  </label>

                  <label>
                    Loại giảm *
                    <select
                      value={form.DiscountType}
                      onChange={(e) =>
                        setForm({ ...form, DiscountType: e.target.value })
                      }
                    >
                      <option value="PERCENT">PERCENT</option>
                      <option value="AMOUNT">AMOUNT</option>
                    </select>
                  </label>

                  <label>
                    Giá trị giảm *
                    <input
                      type="number"
                      min="1"
                      value={form.DiscountValue}
                      onChange={(e) =>
                        setForm({ ...form, DiscountValue: e.target.value })
                      }
                      placeholder={
                        form.DiscountType === "PERCENT" ? "20" : "50000"
                      }
                      required
                    />
                  </label>

                  <label>
                    Trạng thái
                    <select
                      value={form.Status}
                      onChange={(e) =>
                        setForm({ ...form, Status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                </div>

                <div className="voucher-section-title">
                  <span>02</span>
                  <div>
                    <h4>Điều kiện sử dụng</h4>
                    <p>Cấu hình đơn tối thiểu, giảm tối đa và số lượng.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Đơn tối thiểu
                    <input
                      type="number"
                      min="0"
                      value={form.MinOrderAmount}
                      onChange={(e) =>
                        setForm({ ...form, MinOrderAmount: e.target.value })
                      }
                      placeholder="300000"
                    />
                  </label>

                  <label>
                    Giảm tối đa
                    <input
                      type="number"
                      min="0"
                      value={form.MaxDiscountAmount}
                      onChange={(e) =>
                        setForm({ ...form, MaxDiscountAmount: e.target.value })
                      }
                      placeholder="Bỏ trống nếu không giới hạn"
                    />
                  </label>

                  <label>
                    Số lượng *
                    <input
                      type="number"
                      min="0"
                      value={form.Quantity}
                      onChange={(e) =>
                        setForm({ ...form, Quantity: e.target.value })
                      }
                      placeholder="100"
                      required
                    />
                  </label>
                </div>

                <div className="voucher-section-title">
                  <span>03</span>
                  <div>
                    <h4>Thời gian áp dụng</h4>
                    <p>Voucher chỉ hợp lệ trong khoảng ngày này.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Ngày bắt đầu *
                    <input
                      type="date"
                      value={form.StartDate}
                      onChange={(e) =>
                        setForm({ ...form, StartDate: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Ngày kết thúc *
                    <input
                      type="date"
                      value={form.EndDate}
                      onChange={(e) =>
                        setForm({ ...form, EndDate: e.target.value })
                      }
                      required
                    />
                  </label>
                </div>
              </div>

              <aside className="voucher-editor-side">
                <h4>Tóm tắt voucher</h4>

                <div className="voucher-summary-card">
                  <span>Mã</span>
                  <strong>{form.Code || "Chưa nhập"}</strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Giảm giá</span>
                  <strong>
                    {form.DiscountType === "PERCENT"
                      ? `${form.DiscountValue || 0}%`
                      : money(form.DiscountValue || 0)}
                  </strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Đơn tối thiểu</span>
                  <strong>{money(form.MinOrderAmount || 0)}</strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Giảm tối đa</span>
                  <strong>
                    {form.MaxDiscountAmount === ""
                      ? "Không giới hạn"
                      : money(form.MaxDiscountAmount || 0)}
                  </strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Thời hạn</span>
                  <strong>
                    {form.StartDate || "--"} → {form.EndDate || "--"}
                  </strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Trạng thái</span>
                  <strong>{form.Status}</strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions voucher-editor-actions">
              <button
                type="button"
                className="card-btn"
                onClick={() => setShowModal(false)}
              >
                Hủy
              </button>

              <button
                className="card-btn primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Đang lưu..."
                  : editingId
                    ? "Cập nhật voucher"
                    : "Tạo voucher"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
