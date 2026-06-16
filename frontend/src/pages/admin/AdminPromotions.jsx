import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_IMAGE = "/images/promotion-default.jpg";

const emptyForm = {
  title: "",
  description: "",
  discountPercent: "",
  imageUrl: "",
  startDate: "",
  endDate: "",
  status: "ACTIVE",
};

function image(url) {
  return resolveFileUrl(url) || DEFAULT_IMAGE;
}

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

export default function AdminPromotions() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
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

      const [listRes, serviceRes] = await Promise.all([
        axiosClient.get("/admin/promotions", {
          params: {
            keyword: filters.keyword || undefined,
            status: filters.status || undefined,
            fromDate: filters.fromDate || undefined,
            toDate: filters.toDate || undefined,
          },
        }),
        axiosClient.get("/admin/promotions/services"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setServices(serviceRes.data.data || serviceRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách khuyến mãi",
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
      upcoming: items.filter((x) => x.RuntimeStatus === "UPCOMING").length,
      expired: items.filter((x) => x.RuntimeStatus === "EXPIRED").length,
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedServiceIds([]);
    setShowModal(true);
  }

  async function openEdit(item) {
    try {
      setError("");
      setEditingId(item.PromotionId);

      setForm({
        title: item.Title || "",
        description: item.Description || "",
        discountPercent: String(item.DiscountPercent ?? ""),
        imageUrl: item.ImageUrl || "",
        startDate: item.StartDate ? String(item.StartDate).slice(0, 10) : "",
        endDate: item.EndDate ? String(item.EndDate).slice(0, 10) : "",
        status: item.Status || "ACTIVE",
      });

      const res = await axiosClient.get(
        `/admin/promotions/${item.PromotionId}/services`,
      );

      const assigned = res.data.data || res.data || [];
      setSelectedServiceIds(
        assigned.filter((x) => x.IsAssigned).map((x) => String(x.ServiceId)),
      );

      setShowModal(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được dịch vụ áp dụng",
      );
    }
  }

  function validate() {
    if (!form.title.trim()) throw new Error("Vui lòng nhập tên khuyến mãi");

    const percent = Number(form.discountPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new Error("Phần trăm giảm giá phải từ 1 đến 100");
    }

    if (!form.startDate) throw new Error("Vui lòng chọn ngày bắt đầu");
    if (!form.endDate) throw new Error("Vui lòng chọn ngày kết thúc");

    if (new Date(form.startDate) > new Date(form.endDate)) {
      throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        discountPercent: Number(form.discountPercent),
        imageUrl: form.imageUrl.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        serviceIds: selectedServiceIds.map(Number),
      };

      if (editingId) {
        await axiosClient.put(`/admin/promotions/${editingId}`, payload);
      } else {
        await axiosClient.post("/admin/promotions", payload);
      }

      setShowModal(false);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Lưu khuyến mãi thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    const ok = window.confirm(
      `Bạn muốn đổi trạng thái "${item.Title}" thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/promotions/${item.PromotionId}/status`, {
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
    const ok = window.confirm(
      `Bạn chắc chắn muốn xóa khuyến mãi "${item.Title}"?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/promotions/${item.PromotionId}`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Xóa khuyến mãi thất bại",
      );
    }
  }

  function toggleService(id) {
    const key = String(id);
    setSelectedServiceIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  function clearFilters() {
    setFilters({
      keyword: "",
      status: "",
      fromDate: "",
      toDate: "",
    });
  }

  return (
    <section className="admin-page admin-promotions-page">
      <div className="admin-promotions-hero">
        <div>
          <div className="admin-eyebrow">Promotions Management</div>
          <h1>Quản lý khuyến mãi</h1>
          <p>
            Tạo và quản lý chương trình khuyến mãi, thời gian áp dụng, phần trăm
            giảm giá, trạng thái và các dịch vụ được áp dụng.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm khuyến mãi
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">🎁</div>
          <div>
            <p>Tổng khuyến mãi</p>
            <h3>{stats.total}</h3>
            <span>Tất cả promotion</span>
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
            <span>Trong thời gian áp dụng</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <p>Sắp tới / Hết hạn</p>
            <h3>
              {stats.upcoming} / {stats.expired}
            </h3>
            <span>Theo ngày bắt đầu/kết thúc</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-promotions-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm tên hoặc mô tả khuyến mãi..."
        />

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
        <div className="admin-loading-card">
          Đang tải danh sách khuyến mãi...
        </div>
      ) : null}

      {!loading ? (
        <div className="admin-promotions-grid">
          {items.map((item) => (
            <article className="admin-promotion-card" key={item.PromotionId}>
              <div className="admin-promotion-image">
                <img src={image(item.ImageUrl)} alt={item.Title} />
                <div className="admin-promotion-badge">
                  -{Number(item.DiscountPercent || 0)}%
                </div>
                <span
                  className={statusClass(item.RuntimeStatus || item.Status)}
                >
                  {item.RuntimeStatus || item.Status}
                </span>
              </div>

              <div className="admin-promotion-body">
                <h3>{item.Title}</h3>
                <p>{item.Description || "Chưa có mô tả khuyến mãi."}</p>

                <div className="admin-promotion-date">
                  <strong>{dateText(item.StartDate)}</strong>
                  <span>→</span>
                  <strong>{dateText(item.EndDate)}</strong>
                </div>

                <div className="admin-promotion-info">
                  <div>
                    <span>Trạng thái</span>
                    <strong>{item.Status}</strong>
                  </div>
                  <div>
                    <span>Dịch vụ áp dụng</span>
                    <strong>{item.ServiceCount || 0}</strong>
                  </div>
                </div>

                <div className="admin-promotion-services">
                  {item.ServiceNames || "Chưa gán dịch vụ"}
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
            <div className="admin-empty">Không có khuyến mãi phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-promotion-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <img
              className="admin-promotion-detail-image"
              src={image(selected.ImageUrl)}
              alt={selected.Title}
            />

            <div className="admin-detail-title">
              <div>
                <span>Promotion</span>
                <h3>{selected.Title}</h3>
              </div>
              <span
                className={statusClass(
                  selected.RuntimeStatus || selected.Status,
                )}
              >
                {selected.RuntimeStatus || selected.Status}
              </span>
            </div>

            <p className="admin-promotion-detail-desc">
              {selected.Description || "Chưa có mô tả khuyến mãi."}
            </p>

            <div className="admin-detail-grid">
              <p>
                <strong>Giảm giá:</strong>{" "}
                {Number(selected.DiscountPercent || 0)}%
              </p>
              <p>
                <strong>Trạng thái:</strong> {selected.Status}
              </p>
              <p>
                <strong>Bắt đầu:</strong> {dateText(selected.StartDate)}
              </p>
              <p>
                <strong>Kết thúc:</strong> {dateText(selected.EndDate)}
              </p>
              <p>
                <strong>Số dịch vụ:</strong> {selected.ServiceCount || 0}
              </p>
              <p>
                <strong>Dịch vụ:</strong> {selected.ServiceNames || "Chưa gán"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-promotion-form"
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

            <h3>{editingId ? "Sửa khuyến mãi" : "Thêm khuyến mãi"}</h3>

            <div className="admin-form-grid">
              <label>
                Tên khuyến mãi *
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>

              <label>
                Phần trăm giảm *
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.discountPercent}
                  onChange={(e) =>
                    setForm({ ...form, discountPercent: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Ngày bắt đầu *
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Ngày kết thúc *
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>

              <label>
                ImageUrl
                <input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  placeholder="/images/promotion-default.jpg"
                />
              </label>

              <label className="admin-form-wide">
                Mô tả
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="admin-promotion-service-box">
              <div className="admin-panel-head">
                <div>
                  <h2>Dịch vụ áp dụng</h2>
                  <p>Chọn các dịch vụ được áp dụng khuyến mãi này.</p>
                </div>
              </div>

              <div className="admin-promotion-service-list">
                {services.map((s) => (
                  <label
                    className="admin-promo-service-check"
                    key={s.ServiceId}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(String(s.ServiceId))}
                      onChange={() => toggleService(s.ServiceId)}
                    />

                    <img src={image(s.ImageUrl)} alt={s.ServiceName} />

                    <div>
                      <strong>{s.ServiceName}</strong>
                      <span>
                        {s.CategoryName || "Chưa có danh mục"} •{" "}
                        {money(s.Price)} • {s.DurationMinutes} phút
                      </span>
                    </div>
                  </label>
                ))}

                {!services.length ? (
                  <p className="admin-empty">Chưa có dịch vụ AVAILABLE.</p>
                ) : null}
              </div>
            </div>

            <div className="admin-form-actions">
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
                {saving ? "Đang lưu..." : "Lưu khuyến mãi"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
