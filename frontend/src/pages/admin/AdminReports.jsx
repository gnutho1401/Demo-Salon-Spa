import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ fromDate: "", toDate: "" });

  const load = async () => {
    const res = await axiosClient.get("/admin/reports/summary", { params: filters });
    setData(res.data.data || res.data || null);
  };

  useEffect(() => { load(); }, []);

  return (
      <section className="admin-page">
        <div className="section-head">
          <div><div className="eyebrow">Reports</div><h2 className="section-title">Báo cáo hệ thống</h2></div>
        </div>
        <div className="admin-filter-bar card">
          <input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          <input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          <button className="btn" onClick={load}>Apply</button>
        </div>
        {data ? (
          <div className="admin-dashboard-grid">
            <article className="card"><div className="eyebrow">Revenue</div><h3>{Number(data.revenue?.TotalRevenue || 0).toLocaleString("vi-VN")}đ</h3><p>Invoices: {data.revenue?.TotalInvoices || 0}</p></article>
            <article className="card"><div className="eyebrow">Appointments</div><h3>{data.appointments?.TotalAppointments || 0}</h3><p>Completed: {data.appointments?.CompletedAppointments || 0} • Cancelled: {data.appointments?.CancelledAppointments || 0}</p></article>
            <article className="card"><div className="eyebrow">Monthly Revenue</div><ul>{(data.monthlyRevenue || []).map((item) => <li key={`${item.RevenueYear}-${item.RevenueMonth}`}>{item.RevenueMonth}/{item.RevenueYear}: {Number(item.TotalRevenue || 0).toLocaleString("vi-VN")}đ</li>)}</ul></article>
            <article className="card"><div className="eyebrow">Top Services</div><ul>{(data.topServices || []).map((item) => <li key={item.ServiceId}>{item.ServiceName} • {item.AppointmentCount} • {item.AverageRating}/5</li>)}</ul></article>
            <article className="card"><div className="eyebrow">Top Employees</div><ul>{(data.topEmployees || []).map((item) => <li key={item.EmployeeId}>{item.EmployeeName} • {item.AppointmentCount} • {item.AverageRating}/5</li>)}</ul></article>
            <article className="card"><div className="eyebrow">Appointments</div><ul>{(data.customerAppointments || []).map((item) => <li key={item.AppointmentId}>{item.AppointmentDate} • {item.EmployeeName} • {item.AppointmentStatus}</li>)}</ul></article>
          </div>
        ) : <div className="card">Loading...</div>}
      </section>
  );
}
