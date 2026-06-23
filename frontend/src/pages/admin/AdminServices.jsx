import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_IMAGE = "/images/services/skincare.png";

const emptyForm = {
  categoryId: "",
  serviceName: "",
  description: "",
  durationMinutes: "",
  price: "",
  status: "AVAILABLE",
  imageUrl: "",
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

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminServices() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState([]);
  const [statusTab, setStatusTab] = useState("ALL"); // ALL, AVAILABLE, INACTIVE, HIDDEN
  const [filters, setFilters] = useState({
    keyword: "",
    categoryId: "",
  });

  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTech, setSavingTech] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setLoading(true);

      const [listRes, categoryRes] = await Promise.all([
        axiosClient.get("/admin/services", {
          params: {
            keyword: filters.keyword || undefined,
            categoryId: filters.categoryId || undefined,
          },
        }),
        axiosClient.get("/admin/services/categories"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setCategories(categoryRes.data.data || categoryRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách dịch vụ",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeItems = useMemo(() => {
    return items.filter((x) => x.Status !== "UNAVAILABLE");
  }, [items]);

  const stats = useMemo(() => {
    return {
      total: activeItems.length,
      available: activeItems.filter((x) => x.Status === "AVAILABLE").length,
      inactive: activeItems.filter((x) => x.Status === "INACTIVE").length,
      hidden: activeItems.filter((x) => x.Status === "HIDDEN").length,
      appointments: activeItems.reduce(
        (sum, x) => sum + Number(x.AppointmentCount || 0),
        0,
      ),
    };
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      if (statusTab === "ALL") return true;
      return String(item.Status).toUpperCase() === statusTab.toUpperCase();
    });
  }, [activeItems, statusTab]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setTechnicians([]);
    setSelectedTechnicianIds([]);
    setShowModal(true);
  }

  async function openEdit(item) {
    try {
      setError("");
      setEditingId(item.ServiceId);
      setForm({
        categoryId: String(item.CategoryId || ""),
        serviceName: item.ServiceName || "",
        description: item.Description || "",
        durationMinutes: String(item.DurationMinutes || ""),
        price: String(item.Price || ""),
        status: item.Status || "AVAILABLE",
        imageUrl: item.ImageUrl || "",
      });

      const assignedRes = await axiosClient.get(
        `/admin/service-assignments/${item.ServiceId}/technicians`,
      );

      const assigned = assignedRes.data.data || assignedRes.data || [];
      setTechnicians(assigned);
      setSelectedTechnicianIds(
        assigned.filter((x) => x.IsAssigned).map((x) => String(x.EmployeeId)),
      );

      setShowModal(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được technician của dịch vụ",
      );
    }
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.categoryId) return setError("Vui lòng chọn danh mục");
    if (!form.serviceName.trim()) return setError("Vui lòng nhập tên dịch vụ");
    if (!form.durationMinutes || Number(form.durationMinutes) <= 0) {
      return setError("Thời lượng phải lớn hơn 0");
    }
    if (form.price === "" || Number(form.price) < 0) {
      return setError("Giá dịch vụ không hợp lệ");
    }

    const payload = {
      categoryId: Number(form.categoryId),
      serviceName: form.serviceName.trim(),
      description: form.description.trim() || null,
      durationMinutes: Number(form.durationMinutes),
      price: Number(form.price),
      status: form.status,
      imageUrl: form.imageUrl.trim() || null,
    };

    try {
      setSaving(true);
      setError("");

      let serviceId = editingId;

      if (editingId) {
        await axiosClient.put(`/admin/services/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/services", payload);
        const created = res.data.data || res.data;
        serviceId = created.ServiceId;
      }

      if (serviceId && selectedTechnicianIds.length > 0) {
        await axiosClient.put(
          `/admin/service-assignments/${serviceId}/technicians`,
          {
            employeeIds: selectedTechnicianIds.map(Number),
          },
        );
      }

      setShowModal(false);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu dịch vụ thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTechnicians() {
    if (!editingId) return;

    try {
      setSavingTech(true);
      setError("");

      await axiosClient.put(
        `/admin/service-assignments/${editingId}/technicians`,
        {
          employeeIds: selectedTechnicianIds.map(Number),
        },
      );

      await load();
      setShowModal(false);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Lưu technician thất bại",
      );
    } finally {
      setSavingTech(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    const ok = window.confirm(
      `Bạn muốn đổi trạng thái dịch vụ "${item.ServiceName}" thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/services/${item.ServiceId}/status`, {
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
      `Bạn chắc chắn muốn xóa dịch vụ "${item.ServiceName}"?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/services/${item.ServiceId}`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa dịch vụ thất bại",
      );
    }
  }

  function toggleTechnician(id) {
    const key = String(id);
    setSelectedTechnicianIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  function clearFilters() {
    setFilters({ keyword: "", categoryId: "" });
    setStatusTab("ALL");
  }

  return (
    <section className="admin-page admin-services-page">
      <div className="admin-services-hero">
        <div>
          <div className="admin-eyebrow">Services Management</div>
          <h1>Quản lý dịch vụ</h1>
          <p>
            Quản lý dịch vụ spa/salon, danh mục, giá, thời lượng, trạng thái,
            ảnh hiển thị, rating, lịch hẹn và technician phụ trách.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm dịch vụ
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article 
          className={`admin-stat-card ${statusTab === "ALL" ? "active" : ""}`}
          style={{ cursor: "pointer", border: statusTab === "ALL" ? "2px solid #3f2817" : undefined }}
          onClick={() => setStatusTab("ALL")}
        >
          <div className="admin-stat-icon">✨</div>
          <div>
            <p>Tổng dịch vụ</p>
            <h3>{stats.total}</h3>
            <span>Tất cả dịch vụ trong hệ thống</span>
          </div>
        </article>

        <article 
          className={`admin-stat-card ${statusTab === "AVAILABLE" ? "active" : ""}`}
          style={{ cursor: "pointer", border: statusTab === "AVAILABLE" ? "2px solid #3f2817" : undefined }}
          onClick={() => setStatusTab("AVAILABLE")}
        >
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang bán</p>
            <h3>{stats.available}</h3>
            <span>Status AVAILABLE</span>
          </div>
        </article>

        <article 
          className={`admin-stat-card ${statusTab === "INACTIVE" || statusTab === "HIDDEN" ? "active" : ""}`}
          style={{ cursor: "pointer", border: (statusTab === "INACTIVE" || statusTab === "HIDDEN") ? "2px solid #3f2817" : undefined }}
          onClick={() => setStatusTab(statusTab === "INACTIVE" ? "HIDDEN" : "INACTIVE")}
        >
          <div className="admin-stat-icon">⏸</div>
          <div>
            <p>Inactive / Hidden</p>
            <h3>
              {stats.inactive} / {stats.hidden}
            </h3>
            <span>Click để đổi bộ lọc</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">📅</div>
          <div>
            <p>Lịch hẹn liên quan</p>
            <h3>{stats.appointments}</h3>
            <span>Tổng appointment services</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-services-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm tên dịch vụ, mô tả, danh mục..."
        />

        <select
          value={filters.categoryId}
          onChange={(e) =>
            setFilters({ ...filters, categoryId: e.target.value })
          }
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.CategoryId} value={c.CategoryId}>
              {c.CategoryName}
            </option>
          ))}
        </select>

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>

        <button className="card-btn" onClick={clearFilters}>
          Xóa lọc
        </button>
      </div>

      {/* Tabs Phân loại trạng thái */}
      <div className="refund-tabs" style={{ display: "flex", gap: "8px" }}>
        <button 
          className={`refund-tab-btn ${statusTab === "ALL" ? "active" : ""}`}
          onClick={() => setStatusTab("ALL")}
          type="button"
        >
          Tất cả ({stats.total})
        </button>
        <button 
          className={`refund-tab-btn ${statusTab === "AVAILABLE" ? "active" : ""}`}
          onClick={() => setStatusTab("AVAILABLE")}
          type="button"
        >
          Đang bán AVAILABLE ({stats.available})
        </button>
        <button 
          className={`refund-tab-btn ${statusTab === "INACTIVE" ? "active" : ""}`}
          onClick={() => setStatusTab("INACTIVE")}
          type="button"
        >
          Tạm ngưng INACTIVE ({stats.inactive})
        </button>
        <button 
          className={`refund-tab-btn ${statusTab === "HIDDEN" ? "active" : ""}`}
          onClick={() => setStatusTab("HIDDEN")}
          type="button"
        >
          Đang ẩn HIDDEN ({stats.hidden})
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card" style={{ marginTop: "20px" }}>Đang tải danh sách dịch vụ...</div>
      ) : null}

      {!loading ? (
        <div className="admin-services-grid" style={{ marginTop: "20px" }}>
          {filteredItems.map((item) => (
            <article className="admin-service-card" key={item.ServiceId}>
              <div className="admin-service-image">
                <img src={image(item.ImageUrl)} alt={item.ServiceName} />
                <span className={statusClass(item.Status)}>{item.Status}</span>
              </div>

              <div className="admin-service-body">
                <div className="admin-service-category">
                  {item.CategoryName || "Chưa có danh mục"}
                </div>
                <h3>{item.ServiceName}</h3>
                <p>{item.Description || "Chưa có mô tả dịch vụ."}</p>

                <div className="admin-service-price">
                  <strong>{money(item.Price)}</strong>
                  <span>{item.DurationMinutes} phút</span>
                </div>

                <div className="admin-service-info">
                  <div>
                    <span>Lịch hẹn</span>
                    <strong>{item.AppointmentCount || 0}</strong>
                  </div>
                  <div>
                    <span>Hoàn thành</span>
                    <strong>{item.CompletedCount || 0}</strong>
                  </div>
                  <div>
                    <span>Rating</span>
                    <strong>{Number(item.AvgRating || 0).toFixed(1)} ★</strong>
                  </div>
                  <div>
                    <span>Technician</span>
                    <strong>{item.TechnicianCount || 0}</strong>
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

                  {item.Status !== "AVAILABLE" ? (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "AVAILABLE")}
                    >
                      Mở bán
                    </button>
                  ) : (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "INACTIVE")}
                    >
                      Tạm ngưng
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

          {!filteredItems.length ? (
            <div className="admin-empty">Không có dịch vụ phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-service-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <img
              className="admin-service-detail-image"
              src={image(selected.ImageUrl)}
              alt={selected.ServiceName}
            />

            <div className="admin-detail-title">
              <div>
                <span>{selected.CategoryName || "Chưa có danh mục"}</span>
                <h3>{selected.ServiceName}</h3>
              </div>
              <span className={statusClass(selected.Status)}>
                {selected.Status}
              </span>
            </div>

            <p className="admin-service-detail-desc">
              {selected.Description || "Chưa có mô tả dịch vụ."}
            </p>

            <div className="admin-detail-grid">
              <p>
                <strong>Giá:</strong> {money(selected.Price)}
              </p>
              <p>
                <strong>Thời lượng:</strong> {selected.DurationMinutes} phút
              </p>
              <p>
                <strong>Lịch hẹn:</strong> {selected.AppointmentCount || 0}
              </p>
              <p>
                <strong>Hoàn thành:</strong> {selected.CompletedCount || 0}
              </p>
              <p>
                <strong>Review:</strong> {selected.ReviewCount || 0}
              </p>
              <p>
                <strong>Rating:</strong>{" "}
                {Number(selected.AvgRating || 0).toFixed(1)} ★
              </p>
              <p>
                <strong>Technician:</strong> {selected.TechnicianCount || 0}
              </p>
              <p>
                <strong>Category status:</strong>{" "}
                {selected.CategoryStatus || "N/A"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-service-form"
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

            <h3>{editingId ? "Sửa dịch vụ" : "Thêm dịch vụ"}</h3>

            <div className="admin-form-grid">
              <label>
                Danh mục *
                <select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                  required
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((c) => (
                    <option key={c.CategoryId} value={c.CategoryId}>
                      {c.CategoryName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
              </label>

              <label>
                Tên dịch vụ *
                <input
                  value={form.serviceName}
                  onChange={(e) =>
                    setForm({ ...form, serviceName: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Thời lượng phút *
                <input
                  type="number"
                  min="1"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, durationMinutes: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Giá *
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </label>

              <label>
                ImageUrl
                <input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  placeholder="/images/services/skincare.png"
                />
              </label>

              <label className="admin-form-wide">
                Mô tả
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={4}
                />
              </label>
            </div>

            {editingId ? (
              <div className="admin-technician-box">
                <div className="admin-panel-head">
                  <div>
                    <h2>Technician phụ trách</h2>
                    <p>Chọn technician có thể thực hiện dịch vụ này.</p>
                  </div>

                  <button
                    type="button"
                    className="card-btn primary"
                    onClick={saveTechnicians}
                    disabled={savingTech}
                  >
                    {savingTech ? "Đang lưu..." : "Lưu technician"}
                  </button>
                </div>

                <div className="admin-technician-checks">
                  {technicians.map((t) => (
                    <label className="admin-tech-check" key={t.EmployeeId}>
                      <input
                        type="checkbox"
                        checked={selectedTechnicianIds.includes(
                          String(t.EmployeeId),
                        )}
                        onChange={() => toggleTechnician(t.EmployeeId)}
                      />
                      <img
                        src={image(t.ImageUrl || t.AvatarUrl)}
                        alt={t.FullName}
                      />
                      <div>
                        <strong>{t.FullName}</strong>
                        <span>
                          {t.Specialization || t.Position || "Technician"}
                        </span>
                      </div>
                    </label>
                  ))}

                  {!technicians.length ? (
                    <p className="admin-empty">Chưa có technician active.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

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
                {saving ? "Đang lưu..." : "Lưu dịch vụ"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
