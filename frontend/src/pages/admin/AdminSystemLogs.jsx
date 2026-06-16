import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";

export default function AdminSystemLogs() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ keyword: "", actionType: "", fromDate: "", toDate: "" });
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const res = await axiosClient.get("/admin/system-logs", { params: filters });
    setItems(res.data.data || res.data || []);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (item) => {
    const res = await axiosClient.get(`/admin/system-logs/${item.LogId}`);
    setSelected(res.data.data || res.data || item);
  };

  return (
      <section className="admin-page">
        <div className="section-head"><div><div className="eyebrow">System Logs</div><h2 className="section-title">Nhật ký hệ thống</h2></div></div>
        <div className="admin-filter-bar card">
          <input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="Search user, action, description" />
          <select value={filters.actionType} onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}><option value="">All action type</option><option value="CREATE">CREATE</option><option value="UPDATE">UPDATE</option><option value="DELETE">DELETE</option><option value="STATUS">STATUS</option></select>
          <input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          <input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          <button className="btn" onClick={load}>Apply</button>
        </div>
        <div className="admin-list card">
          {items.map((item) => (
            <div key={item.LogId} className="admin-list-row">
              <div>
                <strong>{item.UserName || "System"}</strong>
                <div>{item.ActionType} • {item.ActionName}</div>
                <small>{item.Description}</small>
              </div>
              <div className="admin-card-actions">
                <button className="card-btn primary" onClick={() => openDetail(item)}>Detail</button>
              </div>
            </div>
          ))}
        </div>
        {selected ? <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal-card" onClick={(e)=>e.stopPropagation()}><h3>{selected.ActionName}</h3><p>{selected.UserName}</p><p>{selected.Description}</p><pre style={{ whiteSpace: "pre-wrap" }}>{selected.OldValue}</pre><pre style={{ whiteSpace: "pre-wrap" }}>{selected.NewValue}</pre></div></div> : null}
      </section>
  );
}
