import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_IMAGE = "/images/packages/acne-package.png";

const emptyForm = {
  PackageCategoryId: "",
  PackageName: "",
  Description: "",
  OriginalPrice: "",
  SalePrice: "",
  TotalSessions: "1",
  ValidityDays: "30",
  ImageUrl: "",
  IsHot: false,
  Status: "ACTIVE",
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

export default function AdminPackages() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState({});
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    packageCategoryId: "",
    isHot: "",
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

      const [listRes, categoryRes, serviceRes] = await Promise.all([
        axiosClient.get("/admin/packages", {
          params: {
            keyword: filters.keyword || undefined,
            status: filters.status || undefined,
            packageCategoryId: filters.packageCategoryId || undefined,
            isHot: filters.isHot || undefined,
          },
        }),
        axiosClient.get("/admin/packages/categories"),
        axiosClient.get("/admin/packages/services"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setCategories(categoryRes.data.data || categoryRes.data || []);
      setServices(serviceRes.data.data || serviceRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được packages",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedServiceList = useMemo(() => {
    return services
      .filter((s) => selectedServices[String(s.ServiceId)])
      .map((s) => ({
        ...s,
        SessionCount: Number(selectedServices[String(s.ServiceId)] || 1),
      }));
  }, [services, selectedServices]);

  const preview = useMemo(() => {
    const totalPrice = selectedServiceList.reduce(
      (sum, s) => sum + Number(s.Price || 0) * Number(s.SessionCount || 1),
      0,
    );

    const totalDuration = selectedServiceList.reduce(
      (sum, s) =>
        sum + Number(s.DurationMinutes || 0) * Number(s.SessionCount || 1),
      0,
    );

    const salePrice = Number(form.SalePrice || 0);
    const save = Math.max(totalPrice - salePrice, 0);

    return { totalPrice, totalDuration, save };
  }, [selectedServiceList, form.SalePrice]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((x) => x.Status === "ACTIVE").length,
      hot: items.filter((x) => x.IsHot).length,
      customers: items.reduce(
        (sum, x) => sum + Number(x.CustomerCount || 0),
        0,
      ),
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedServices({});
    setShowModal(true);
    setError("");
  }

  async function openEdit(item) {
    try {
      setError("");
      setEditingId(item.PackageId);

      setForm({
        PackageCategoryId: item.PackageCategoryId
          ? String(item.PackageCategoryId)
          : "",
        PackageName: item.PackageName || "",
        Description: item.Description || "",
        OriginalPrice: String(item.OriginalPrice ?? ""),
        SalePrice: String(item.SalePrice ?? ""),
        TotalSessions: String(item.TotalSessions ?? "1"),
        ValidityDays: String(item.ValidityDays ?? "30"),
        ImageUrl: item.ImageUrl || "",
        IsHot: !!item.IsHot,
        Status: item.Status || "ACTIVE",
      });

      const res = await axiosClient.get(
        `/admin/packages/${item.PackageId}/services`,
      );

      const assigned = res.data.data || res.data || [];
      const next = {};

      assigned.forEach((s) => {
        if (s.IsAssigned) {
          next[String(s.ServiceId)] = Number(s.SessionCount || 1);
        }
      });

      setSelectedServices(next);
      setShowModal(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được dịch vụ package",
      );
    }
  }

  function validate() {
    if (!form.PackageName.trim()) throw new Error("Vui lòng nhập tên package");

    if (form.OriginalPrice === "" || Number(form.OriginalPrice) < 0) {
      throw new Error("OriginalPrice không hợp lệ");
    }

    if (form.SalePrice === "" || Number(form.SalePrice) < 0) {
      throw new Error("SalePrice không hợp lệ");
    }

    if (Number(form.SalePrice) > Number(form.OriginalPrice)) {
      throw new Error("SalePrice không được lớn hơn OriginalPrice");
    }

    if (Number(form.TotalSessions) <= 0) {
      throw new Error("TotalSessions phải lớn hơn 0");
    }

    if (Number(form.ValidityDays) <= 0) {
      throw new Error("ValidityDays phải lớn hơn 0");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const servicesPayload = Object.entries(selectedServices).map(
        ([serviceId, sessionCount]) => ({
          serviceId: Number(serviceId),
          sessionCount: Number(sessionCount || 1),
        }),
      );

      const payload = {
        PackageCategoryId: form.PackageCategoryId
          ? Number(form.PackageCategoryId)
          : null,
        PackageName: form.PackageName.trim(),
        Description: form.Description.trim() || null,
        OriginalPrice: Number(form.OriginalPrice || 0),
        SalePrice: Number(form.SalePrice || 0),
        TotalSessions: Number(form.TotalSessions || 1),
        ValidityDays: Number(form.ValidityDays || 30),
        ImageUrl: form.ImageUrl.trim() || null,
        IsHot: form.IsHot ? 1 : 0,
        Status: form.Status,
        services: servicesPayload,
      };

      if (editingId) {
        await axiosClient.put(`/admin/packages/${editingId}`, payload);
      } else {
        await axiosClient.post("/admin/packages", payload);
      }

      setShowModal(false);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu package thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    if (
      !window.confirm(
        `Đổi trạng thái "${item.PackageName}" thành ${nextStatus}?`,
      )
    )
      return;

    try {
      setError("");
      await axiosClient.patch(`/admin/packages/${item.PackageId}/status`, {
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
    if (
      !window.confirm(`Bạn chắc chắn muốn xóa package "${item.PackageName}"?`)
    )
      return;

    try {
      setError("");
      await axiosClient.delete(`/admin/packages/${item.PackageId}`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa package thất bại",
      );
    }
  }

  function toggleService(id) {
    const key = String(id);

    setSelectedServices((prev) => {
      const next = { ...prev };

      if (next[key]) delete next[key];
      else next[key] = 1;

      return next;
    });
  }

  function changeServiceSession(id, value) {
    const key = String(id);
    const session = Math.max(1, Number(value || 1));

    setSelectedServices((prev) => ({
      ...prev,
      [key]: session,
    }));
  }

  return (
    <section className="admin-page admin-packages-page">
      <div className="admin-packages-hero">
        <div>
          <div className="admin-eyebrow">Packages Management</div>
          <h1>Quản lý gói dịch vụ</h1>
          <p>
            Quản lý combo/liệu trình theo đúng schema: OriginalPrice, SalePrice,
            TotalSessions, ValidityDays, IsHot và service session.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm package
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">📦</div>
          <div>
            <p>Tổng package</p>
            <h3>{stats.total}</h3>
            <span>Tất cả gói dịch vụ</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang bán</p>
            <h3>{stats.active}</h3>
            <span>Status ACTIVE</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🔥</div>
          <div>
            <p>Hot package</p>
            <h3>{stats.hot}</h3>
            <span>IsHot = true</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Customer đã mua</p>
            <h3>{stats.customers}</h3>
            <span>Theo CustomerPackages</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-packages-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm tên package hoặc mô tả..."
        />

        <select
          value={filters.packageCategoryId}
          onChange={(e) =>
            setFilters({ ...filters, packageCategoryId: e.target.value })
          }
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.PackageCategoryId} value={c.PackageCategoryId}>
              {c.CategoryName}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="HIDDEN">HIDDEN</option>
        </select>

        <select
          value={filters.isHot}
          onChange={(e) => setFilters({ ...filters, isHot: e.target.value })}
        >
          <option value="">Tất cả Hot</option>
          <option value="1">Hot</option>
          <option value="0">Không hot</option>
        </select>

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>

        <button
          className="card-btn"
          onClick={() =>
            setFilters({
              keyword: "",
              status: "",
              packageCategoryId: "",
              isHot: "",
            })
          }
        >
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải packages...</div>
      ) : null}

      {!loading ? (
        <div className="admin-packages-grid">
          {items.map((item) => (
            <article className="admin-package-card" key={item.PackageId}>
              <div className="admin-package-image">
                <img src={image(item.ImageUrl)} alt={item.PackageName} />
                <span className={statusClass(item.Status)}>{item.Status}</span>
                {item.IsHot ? <b className="package-hot-badge">HOT</b> : null}
              </div>

              <div className="admin-package-body">
                <div className="admin-package-tag">
                  {item.PackageCategoryName || "Package"}
                </div>

                <h3>{item.PackageName}</h3>
                <p>{item.Description || "Chưa có mô tả package."}</p>

                <div className="admin-package-price">
                  <div>
                    <span>Sale Price</span>
                    <strong>{money(item.SalePrice)}</strong>
                  </div>
                  <del>{money(item.OriginalPrice)}</del>
                </div>

                <div className="admin-package-info">
                  <div>
                    <span>Sessions</span>
                    <strong>{item.TotalSessions || 0}</strong>
                  </div>
                  <div>
                    <span>Validity</span>
                    <strong>{item.ValidityDays || 0} ngày</strong>
                  </div>
                  <div>
                    <span>Service</span>
                    <strong>{item.ServiceCount || 0}</strong>
                  </div>
                  <div>
                    <span>Customer</span>
                    <strong>{item.CustomerCount || 0}</strong>
                  </div>
                </div>

                <div className="admin-package-services">
                  {item.ServiceNames || "Chưa gán service"}
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
            <div className="admin-empty">Không có package phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-package-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <img
              className="admin-package-detail-image"
              src={image(selected.ImageUrl)}
              alt={selected.PackageName}
            />

            <div className="admin-detail-title">
              <div>
                <span>{selected.PackageCategoryName || "Package"}</span>
                <h3>{selected.PackageName}</h3>
              </div>
              <span className={statusClass(selected.Status)}>
                {selected.Status}
              </span>
            </div>

            <p className="admin-package-detail-desc">
              {selected.Description || "Chưa có mô tả package."}
            </p>

            <div className="admin-detail-grid">
              <p>
                <strong>OriginalPrice:</strong> {money(selected.OriginalPrice)}
              </p>
              <p>
                <strong>SalePrice:</strong> {money(selected.SalePrice)}
              </p>
              <p>
                <strong>Tiết kiệm:</strong>{" "}
                {money(
                  Number(selected.OriginalPrice || 0) -
                    Number(selected.SalePrice || 0),
                )}
              </p>
              <p>
                <strong>TotalSessions:</strong> {selected.TotalSessions || 0}
              </p>
              <p>
                <strong>ValidityDays:</strong> {selected.ValidityDays || 0} ngày
              </p>
              <p>
                <strong>IsHot:</strong> {selected.IsHot ? "Yes" : "No"}
              </p>
              <p>
                <strong>Service:</strong> {selected.ServiceCount || 0}
              </p>
              <p>
                <strong>Customer đã mua:</strong> {selected.CustomerCount || 0}
              </p>
              <p>
                <strong>Active customer:</strong>{" "}
                {selected.ActiveCustomerCount || 0}
              </p>
              <p>
                <strong>Tổng giá service:</strong>{" "}
                {money(selected.TotalServicePrice)}
              </p>
              <p>
                <strong>Tổng thời lượng:</strong>{" "}
                {selected.TotalDurationMinutes || 0} phút
              </p>
              <p>
                <strong>Services:</strong> {selected.ServiceNames || "Chưa gán"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-package-form luxury-package-editor"
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

            <div className="package-editor-head">
              <div>
                <span>{editingId ? "Edit Package" : "Create Package"}</span>
                <h3>{editingId ? "Sửa package" : "Thêm package mới"}</h3>
                <p>
                  Form này đã sửa đúng DB: OriginalPrice, SalePrice,
                  TotalSessions, ValidityDays, IsHot và SessionCount cho từng
                  service.
                </p>
              </div>

              <div className="package-preview-card">
                <small>LIVE PREVIEW</small>
                <strong>{form.PackageName || "LUXURY SPA COMBO"}</strong>
                <b>{money(form.SalePrice || 0)}</b>
                <span>
                  {Object.keys(selectedServices).length} service •{" "}
                  {form.ValidityDays || 0} ngày
                </span>
              </div>
            </div>

            <div className="package-editor-layout">
              <div className="package-editor-main">
                <div className="package-section-title">
                  <span>01</span>
                  <div>
                    <h4>Thông tin package</h4>
                    <p>Nhập đúng các cột đang có trong bảng Packages.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Danh mục package
                    <select
                      value={form.PackageCategoryId}
                      onChange={(e) =>
                        setForm({ ...form, PackageCategoryId: e.target.value })
                      }
                    >
                      <option value="">Chưa chọn</option>
                      {categories.map((c) => (
                        <option
                          key={c.PackageCategoryId}
                          value={c.PackageCategoryId}
                        >
                          {c.CategoryName}
                        </option>
                      ))}
                    </select>
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
                      <option value="HIDDEN">HIDDEN</option>
                    </select>
                  </label>

                  <label>
                    Tên package *
                    <input
                      value={form.PackageName}
                      onChange={(e) =>
                        setForm({ ...form, PackageName: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    IsHot
                    <select
                      value={form.IsHot ? "1" : "0"}
                      onChange={(e) =>
                        setForm({ ...form, IsHot: e.target.value === "1" })
                      }
                    >
                      <option value="0">Không hot</option>
                      <option value="1">Hot package</option>
                    </select>
                  </label>

                  <label>
                    OriginalPrice *
                    <input
                      type="number"
                      min="0"
                      value={form.OriginalPrice}
                      onChange={(e) =>
                        setForm({ ...form, OriginalPrice: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    SalePrice *
                    <input
                      type="number"
                      min="0"
                      value={form.SalePrice}
                      onChange={(e) =>
                        setForm({ ...form, SalePrice: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    TotalSessions *
                    <input
                      type="number"
                      min="1"
                      value={form.TotalSessions}
                      onChange={(e) =>
                        setForm({ ...form, TotalSessions: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    ValidityDays *
                    <input
                      type="number"
                      min="1"
                      value={form.ValidityDays}
                      onChange={(e) =>
                        setForm({ ...form, ValidityDays: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label className="admin-form-wide">
                    ImageUrl
                    <input
                      value={form.ImageUrl}
                      onChange={(e) =>
                        setForm({ ...form, ImageUrl: e.target.value })
                      }
                      placeholder="/images/packages/acne-package.png"
                    />
                  </label>

                  <label className="admin-form-wide">
                    Mô tả
                    <textarea
                      rows={4}
                      value={form.Description}
                      onChange={(e) =>
                        setForm({ ...form, Description: e.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="package-section-title">
                  <span>02</span>
                  <div>
                    <h4>Service trong package</h4>
                    <p>Chọn service và nhập số buổi cho từng service.</p>
                  </div>
                </div>

                <div className="package-service-list">
                  {services.map((s) => {
                    const checked = !!selectedServices[String(s.ServiceId)];

                    return (
                      <div
                        className={`package-service-check ${checked ? "checked" : ""}`}
                        key={s.ServiceId}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(s.ServiceId)}
                        />

                        <img src={image(s.ImageUrl)} alt={s.ServiceName} />

                        <div>
                          <strong>{s.ServiceName}</strong>
                          <span>
                            {s.CategoryName || "No category"} • {money(s.Price)}{" "}
                            • {s.DurationMinutes} phút
                          </span>
                        </div>

                        {checked ? (
                          <input
                            className="package-session-input"
                            type="number"
                            min="1"
                            value={selectedServices[String(s.ServiceId)]}
                            onChange={(e) =>
                              changeServiceSession(s.ServiceId, e.target.value)
                            }
                          />
                        ) : null}
                      </div>
                    );
                  })}

                  {!services.length ? (
                    <p className="admin-empty">Chưa có service AVAILABLE.</p>
                  ) : null}
                </div>
              </div>

              <aside className="package-editor-side">
                <h4>Tóm tắt package</h4>

                <div className="package-summary-card">
                  <span>Tên gói</span>
                  <strong>{form.PackageName || "Chưa nhập"}</strong>
                </div>

                <div className="package-summary-card">
                  <span>OriginalPrice</span>
                  <strong>{money(form.OriginalPrice || 0)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>SalePrice</span>
                  <strong>{money(form.SalePrice || 0)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Giảm trực tiếp</span>
                  <strong>
                    {money(
                      Math.max(
                        Number(form.OriginalPrice || 0) -
                          Number(form.SalePrice || 0),
                        0,
                      ),
                    )}
                  </strong>
                </div>

                <div className="package-summary-card">
                  <span>Tổng giá service</span>
                  <strong>{money(preview.totalPrice)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Tiết kiệm so với service</span>
                  <strong>{money(preview.save)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Tổng thời lượng</span>
                  <strong>{preview.totalDuration} phút</strong>
                </div>

                <div className="package-summary-card">
                  <span>Service đã chọn</span>
                  <strong>{Object.keys(selectedServices).length}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Hot</span>
                  <strong>{form.IsHot ? "Yes" : "No"}</strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions package-editor-actions">
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
                    ? "Cập nhật package"
                    : "Tạo package"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
