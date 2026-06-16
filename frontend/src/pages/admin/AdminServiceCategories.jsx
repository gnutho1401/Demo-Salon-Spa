import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";

const emptyForm = { CategoryName: "", Description: "", ImageUrl: "", Status: "ACTIVE" };

export default function AdminServiceCategories() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const res = await axiosClient.get("/admin/service-categories");
    setItems(res.data.data || res.data || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (item) => { setEditingId(item.CategoryId); setForm({ CategoryName: item.CategoryName || "", Description: item.Description || "", ImageUrl: item.ImageUrl || "", Status: item.Status || "ACTIVE" }); setShowModal(true); };
  const submit = async (e) => { e.preventDefault(); if (editingId) await axiosClient.put(`/admin/service-categories/${editingId}`, form); else await axiosClient.post("/admin/service-categories", form); setShowModal(false); await load(); };
  const toggle = async (id) => { await axiosClient.patch(`/admin/service-categories/${id}/toggle-active`); await load(); };
  const remove = async (id) => { await axiosClient.delete(`/admin/service-categories/${id}`); await load(); };

  return (
    <section className="admin-page">
      <div className="section-head">
        <div><div className="eyebrow">Service Categories</div><h2 className="section-title">Quản lý service categories</h2></div>
        <button className="btn" onClick={openCreate}>Add category</button>
      </div>
      <div className="admin-list card">
        {items.map((item) => (
          <div key={item.CategoryId} className="admin-list-row">
            <div>
              <strong>{item.CategoryName}</strong>
              <div>{item.Status} • Services {item.ServiceCount}</div>
              <small>{item.Description}</small>
            </div>
            <div className="admin-card-actions">
              <button className="card-btn primary" onClick={() => openEdit(item)}>Edit</button>
              <button className="card-btn" onClick={() => toggle(item.CategoryId)}>Toggle</button>
              <button className="card-btn" onClick={() => remove(item.CategoryId)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {showModal ? <div className="modal-backdrop" onClick={() => setShowModal(false)}><form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}><h3>{editingId ? "Edit category" : "Add category"}</h3><input value={form.CategoryName} onChange={(e) => setForm({ ...form, CategoryName: e.target.value })} placeholder="Category name" /><textarea value={form.Description} onChange={(e) => setForm({ ...form, Description: e.target.value })} placeholder="Description" /><input value={form.ImageUrl} onChange={(e) => setForm({ ...form, ImageUrl: e.target.value })} placeholder="Image url" /><select value={form.Status} onChange={(e) => setForm({ ...form, Status: e.target.value })}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select><button className="btn" type="submit">Save</button></form></div> : null}
    </section>
  );
}
