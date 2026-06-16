import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";

export default function AdminAIMonitoring() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ type: "", checked: "", keyword: "", fromDate: "", toDate: "" });
  const [selected, setSelected] = useState(null);
  const [checkResult, setCheckResult] = useState("");

  const load = async () => {
    const res = await axiosClient.get("/admin/ai-monitoring", { params: filters });
    setItems(res.data.data || res.data || []);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (item) => {
    const res = await axiosClient.get(`/admin/ai-monitoring/${item.ItemType}/${item.ItemId}`);
    setSelected(res.data.data || res.data || item);
    setCheckResult((res.data.data || res.data || item).CheckResult || "");
  };

  const markChecked = async () => {
    await axiosClient.patch(`/admin/ai-monitoring/${selected.ItemType}/${selected.ItemId}/checked`, { checked: true, checkResult });
    await load();
    await openDetail({ ItemType: selected.ItemType, ItemId: selected.ItemId });
  };

  return (
      <section className="admin-page">
        <div className="section-head"><div><div className="eyebrow">AI Monitoring</div><h2 className="section-title">Quản lý dữ liệu AI</h2></div></div>
        <div className="admin-filter-bar card">
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">All types</option><option value="recommendation">recommendation</option><option value="prediction">prediction</option><option value="chat">chat</option><option value="audit">audit</option></select>
          <select value={filters.checked} onChange={(e) => setFilters({ ...filters, checked: e.target.value })}><option value="">All checked</option><option value="1">Checked</option><option value="0">Unchecked</option></select>
          <input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="Search" />
          <input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          <input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          <button className="btn" onClick={load}>Apply</button>
        </div>
        <div className="admin-list card">
          {items.map((item) => (
            <div key={`${item.ItemType}-${item.ItemId}`} className="admin-list-row">
              <div><strong>{item.Title}</strong><div>{item.ItemType} • {item.UserName || "System"}</div><small>{item.Content}</small></div>
              <div className="admin-card-actions"><button className="card-btn primary" onClick={() => openDetail(item)}>Detail</button></div>
            </div>
          ))}
        </div>
        {selected ? <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal-card" onClick={(e)=>e.stopPropagation()}><h3>{selected.Title || selected.FeatureName || selected.RecommendationType || selected.PredictionType || selected.ItemType}</h3><p>{selected.UserName}</p><p>{selected.Content || selected.Prompt || selected.Question}</p><p>{selected.Detail || selected.Answer || selected.CheckResult}</p><textarea value={checkResult} onChange={(e)=>setCheckResult(e.target.value)} placeholder="Check result" />{selected.ItemType === "audit" ? <button className="btn" onClick={markChecked}>Mark checked</button> : null}</div></div> : null}
      </section>
  );
}
