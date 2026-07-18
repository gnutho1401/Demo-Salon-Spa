import { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useAuth } from '../../context/AuthContext';
import axiosClient, { resolveFileUrl } from '../../api/axiosClient';

const QUICK_SUGGESTIONS = [
  'Tôi muốn tư vấn dịch vụ chăm sóc da',
  'Giá dịch vụ nail bao nhiêu?',
  'Hướng dẫn đặt lịch hẹn',
  'Dịch vụ nào phù hợp lần đầu?',
  'Có combo nào đang giảm giá không?',
];

/** Simple markdown-like formatting */
function formatAIText(text) {
  if (!text) return '';
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n/g, '<br/>');

  // Replace [Đặt lịch: Tên dịch vụ | ID | Stylist: Tên kỹ thuật viên | EmployeeID] with direct combined booking buttons
  formatted = formatted.replace(
    /\[Đặt lịch:\s*(.*?)\s*\|\s*(\d+)\s*\|\s*Stylist:\s*(.*?)\s*\|\s*(\d+)\s*\]/g,
    '<a href="/customer/booking?serviceId=$2&employeeId=$4" class="chat-booking-btn">📅 Đặt lịch: $1 cùng $3</a>'
  );

  // Replace [Đặt lịch: Tên dịch vụ | ID] with direct booking buttons
  formatted = formatted.replace(
    /\[Đặt lịch:\s*(.*?)\s*\|\s*(\d+)\s*\]/g,
    '<a href="/customer/booking?serviceId=$2" class="chat-booking-btn">📅 Đặt lịch: $1</a>'
  );

  return formatted;
}

function parseMessageWidget(text) {
  if (!text) return null;
  const match = text.match(/\[\[WIDGET:([^\]]+)\]\]/);
  if (!match) return null;

  const parts = match[1].split('|');
  const type = parts[0];
  const args = parts.slice(1);
  return { type, args, rawTag: match[0] };
}

function parseMessageSuggestions(text) {
  if (!text) return [];
  const match = text.match(/\[\[SUGGESTIONS:([^\]]+)\]\]/);
  if (!match) return [];
  return match[1].split('|').map(s => s.trim()).filter(Boolean);
}

function AiChatWidget({ type: initialType, args: initialArgs }) {
  const navigate = useNavigate();
  const [type, setType] = useState(initialType);
  const [args, setArgs] = useState(initialArgs);

  useEffect(() => {
    setType(initialType);
    setArgs(initialArgs);
  }, [initialType, initialArgs]);

  // Widget: SEARCH_SERVICES
  if (type === 'SEARCH_SERVICES') {
    const keyword = args[0] ? String(args[0]).toLowerCase().trim() : '';
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchServices = async () => {
        try {
          const res = await axiosClient.get('/services');
          let list = res.data?.data || res.data || [];
          if (keyword) {
            list = list.filter(
              (s) =>
                s.ServiceName.toLowerCase().includes(keyword) ||
                s.Description?.toLowerCase().includes(keyword)
            );
          }
          setServices(list.slice(0, 5));
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchServices();
    }, [keyword]);

    if (loading) return <div className="ai-chat-widget">⌛ Đang tìm dịch vụ...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">🔍 Kết quả tìm kiếm dịch vụ</div>
        {services.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Không tìm thấy dịch vụ nào phù hợp.</div>
        ) : (
          <div className="ai-widget-service-list">
            {services.map((s) => (
              <div className="ai-widget-service-item" key={s.ServiceId}>
                <div className="ai-widget-service-info">
                  <h4>{s.ServiceName}</h4>
                  <p>{s.Description || 'Không có mô tả chi tiết.'}</p>
                  <div className="ai-widget-service-meta">
                    {Number(s.Price || 0).toLocaleString('vi-VN')}đ • {s.DurationMinutes} phút
                  </div>
                </div>
                <div className="ai-widget-service-action">
                  <button
                    type="button"
                    className="slots-btn"
                    onClick={() => {
                      setType('SLOTS');
                      setArgs([String(s.ServiceId), '', '']);
                    }}
                  >
                    Xem giờ trống
                  </button>
                  <button
                    type="button"
                    className="book-btn"
                    onClick={() => navigate(`/customer/booking?serviceId=${s.ServiceId}`)}
                  >
                    Đặt lịch ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget: SEARCH_STYLISTS
  if (type === 'SEARCH_STYLISTS') {
    const keyword = args[0] ? String(args[0]).toLowerCase().trim() : '';
    const [stylists, setStylists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchStylists = async () => {
        try {
          const res = await axiosClient.get('/waiting-list/options');
          const data = res.data?.data || res.data || {};
          let list = data.employees || [];
          if (keyword) {
            list = list.filter(
              (e) =>
                e.FullName.toLowerCase().includes(keyword) ||
                (e.Specialization && e.Specialization.toLowerCase().includes(keyword)) ||
                (e.Position && e.Position.toLowerCase().includes(keyword))
            );
          }
          setStylists(list.slice(0, 5));
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchStylists();
    }, [keyword]);

    if (loading) return <div className="ai-chat-widget">⌛ Đang tìm chuyên viên...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">💇 Danh sách chuyên viên/stylist</div>
        {stylists.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Không tìm thấy chuyên viên nào phù hợp.</div>
        ) : (
          <div className="ai-widget-stylist-list">
            {stylists.map((emp) => (
              <div className="ai-widget-stylist-item" key={emp.EmployeeId}>
                <div className="ai-widget-stylist-profile">
                  <img
                    src={resolveFileUrl(emp.ImageUrl) || DEFAULT_AVATAR}
                    alt={emp.FullName}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <div className="ai-widget-stylist-details">
                    <h4>{emp.FullName}</h4>
                    <span>{emp.Specialization || emp.Position || 'Kỹ thuật viên'}</span>
                    <small>⭐ {Number(emp.AverageRating || 0).toFixed(1)} / 5</small>
                  </div>
                </div>
                <div className="ai-widget-stylist-action">
                  <button
                    type="button"
                    className="book-btn"
                    onClick={() => navigate(`/customer/booking?employeeId=${emp.EmployeeId}`)}
                  >
                    Đặt lịch ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget 1: MY_APPOINTMENTS
  if (type === 'MY_APPOINTMENTS') {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [msg, setMsg] = useState('');

    // Reschedule states
    const [reschedulingAptId, setReschedulingAptId] = useState(null);
    const [rescheduleInfo, setRescheduleInfo] = useState(null);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);
    const [rescheduleSelectedEmployeeId, setRescheduleSelectedEmployeeId] = useState('');
    const [rescheduleSelectedDate, setRescheduleSelectedDate] = useState('');
    const [rescheduleSlots, setRescheduleSlots] = useState([]);
    const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
    const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState('');
    const [rescheduleActionLoading, setRescheduleActionLoading] = useState(false);
    const [rescheduleError, setRescheduleError] = useState('');

    const dateOptions = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      let label = '';
      if (i === 0) label = 'Hôm nay';
      else if (i === 1) label = 'Ngày mai';
      else if (i === 2) label = 'Ngày kia';
      else {
        const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        label = daysOfWeek[d.getDay()];
      }
      dateOptions.push({
        date: `${yyyy}-${mm}-${dd}`,
        label: `${label} (${dd}/${mm})`
      });
    }

    const loadApts = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get('/appointments/my');
        const active = (res.data.data || res.data || []).filter(
          a => a.Status === 'PENDING' || a.Status === 'CONFIRMED' || a.Status === 'PENDING_PAYMENT'
        );
        setAppointments(active);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadApts();
    }, []);

    const handleCancel = async (id) => {
      if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn này?')) return;
      try {
        setActionLoading(id);
        await axiosClient.delete(`/appointments/${id}`);
        setMsg('Đã hủy lịch hẹn thành công!');
        loadApts();
      } catch (err) {
        alert(err.response?.data?.message || 'Không thể hủy lịch hẹn.');
      } finally {
        setActionLoading(null);
      }
    };

    const startReschedule = async (apt) => {
      setReschedulingAptId(apt.AppointmentId);
      setRescheduleError('');
      setRescheduleSelectedSlot('');
      setRescheduleSelectedDate(dateOptions[0].date);
      try {
        setRescheduleLoading(true);
        const res = await axiosClient.get(`/appointments/${apt.AppointmentId}/reschedule`);
        const info = res.data?.data || res.data || {};
        setRescheduleInfo(info);
        setRescheduleSelectedEmployeeId(String(info.EmployeeId || ''));
      } catch (err) {
        setRescheduleError('Không lấy được thông tin đổi lịch.');
      } finally {
        setRescheduleLoading(false);
      }
    };

    useEffect(() => {
      const loadRescheduleSlots = async () => {
        if (!reschedulingAptId || !rescheduleInfo || !rescheduleSelectedEmployeeId || !rescheduleSelectedDate) return;
        try {
          setRescheduleSlotsLoading(true);
          setRescheduleSelectedSlot('');
          const res = await axiosClient.get('/appointments/available-slots', {
            params: {
              serviceId: rescheduleInfo.ServiceId,
              employeeId: rescheduleSelectedEmployeeId,
              appointmentDate: rescheduleSelectedDate,
              excludeAppointmentId: reschedulingAptId
            }
          });
          const data = res.data.data;
          const slotsList = data && typeof data === 'object' && !Array.isArray(data) ? data.slots : data;
          setRescheduleSlots(slotsList || []);
        } catch (err) {
          setRescheduleSlots([]);
        } finally {
          setRescheduleSlotsLoading(false);
        }
      };
      loadRescheduleSlots();
    }, [reschedulingAptId, rescheduleInfo, rescheduleSelectedEmployeeId, rescheduleSelectedDate]);

    const confirmReschedule = async () => {
      if (!rescheduleSelectedSlot) return;
      try {
        setRescheduleActionLoading(true);
        setRescheduleError('');
        await axiosClient.post(`/appointments/${reschedulingAptId}/reschedule`, {
          appointmentDate: rescheduleSelectedDate,
          employeeId: Number(rescheduleSelectedEmployeeId),
          startTime: rescheduleSelectedSlot.length === 5 ? `${rescheduleSelectedSlot}:00` : rescheduleSelectedSlot,
          reason: 'Đổi lịch hẹn qua AI Assistant'
        });
        setMsg('Đã đổi lịch hẹn thành công!');
        setReschedulingAptId(null);
        setRescheduleInfo(null);
        loadApts();
      } catch (err) {
        setRescheduleError(err.response?.data?.message || 'Không thể đổi lịch hẹn.');
      } finally {
        setRescheduleActionLoading(false);
      }
    };

    if (loading) return <div className="ai-chat-widget">⌛ Đang tải lịch hẹn...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">📅 Lịch hẹn của bạn</div>
        {msg && <div style={{ color: '#2e7d32', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
        {appointments.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Bạn không có lịch hẹn nào sắp tới.</div>
        ) : (
          <div className="ai-widget-apt-list">
            {appointments.map(a => (
              <div className="ai-widget-apt-item" key={a.AppointmentId} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div className="ai-widget-apt-info">
                    <strong>{a.ServiceName}</strong>
                    <span>Stylist: {a.EmployeeFullName || a.EmployeeName || 'Bất kỳ'}</span>
                    <span>Thời gian: {new Date(a.AppointmentDate).toLocaleDateString('vi-VN')} lúc {a.StartTime?.slice(0, 5)}</span>
                  </div>
                  {reschedulingAptId !== a.AppointmentId && (
                    <div className="ai-widget-apt-action" style={{ display: 'flex', gap: 6 }}>
                      <button 
                        style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                        onClick={() => startReschedule(a)}
                      >
                        Đổi lịch
                      </button>
                      <button 
                        disabled={actionLoading === a.AppointmentId}
                        onClick={() => handleCancel(a.AppointmentId)}
                        style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, border: 'none', background: '#ffe5ec', color: '#d81b60', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {actionLoading === a.AppointmentId ? '...' : 'Hủy'}
                      </button>
                    </div>
                  )}
                </div>

                {reschedulingAptId === a.AppointmentId && (
                  <div className="ai-widget-reschedule-panel" style={{ borderTop: '1px solid #eee', marginTop: 10, paddingTop: 10 }}>
                    <div className="ai-widget-reschedule-title" style={{ fontSize: 12, fontWeight: 700, color: '#ff4778', marginBottom: 8 }}>
                      🔄 Chọn thời gian đổi lịch mới
                    </div>
                    {rescheduleLoading ? (
                      <div style={{ fontSize: 12, color: '#666' }}>⌛ Đang tải thông tin dịch vụ...</div>
                    ) : (
                      <>
                        {/* Date Selection */}
                        <div className="ai-widget-date-selector">
                          {dateOptions.map(opt => (
                            <button
                              key={opt.date}
                              className={`ai-date-chip ${rescheduleSelectedDate === opt.date ? 'active' : ''}`}
                              onClick={() => setRescheduleSelectedDate(opt.date)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Stylist Selection */}
                        {rescheduleInfo?.AvailableEmployees?.length > 0 && (
                          <div className="ai-widget-employee-selector-wrapper" style={{ marginTop: 8 }}>
                            <label className="ai-widget-label">Chọn Stylist:</label>
                            <div className="ai-widget-employee-list">
                              {rescheduleInfo.AvailableEmployees.map(emp => (
                                <div
                                  key={emp.EmployeeId}
                                  className={`ai-employee-card ${String(rescheduleSelectedEmployeeId) === String(emp.EmployeeId) ? 'active' : ''}`}
                                  onClick={() => setRescheduleSelectedEmployeeId(String(emp.EmployeeId))}
                                >
                                  <img 
                                    src={resolveFileUrl(emp.ImageUrl || emp.AvatarUrl || emp.Avatar) || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'} 
                                    alt={emp.EmployeeName} 
                                    className="ai-employee-avatar" 
                                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'; }}
                                  />
                                  <div className="ai-employee-info">
                                    <span className="ai-employee-name">{emp.EmployeeName}</span>
                                    <span className="ai-employee-rating">⭐️ {Number(emp.AverageRating || 0).toFixed(1)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {rescheduleError && <div style={{ color: '#d32f2f', fontSize: 12, marginTop: 8 }}>{rescheduleError}</div>}

                        {/* Slots */}
                        <div className="ai-widget-slots-section" style={{ marginTop: 8 }}>
                          {rescheduleSlotsLoading ? (
                            <div className="ai-widget-slots-loading">⌛ Đang tìm giờ trống...</div>
                          ) : rescheduleSlots.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#6b4f5a', padding: '6px 0' }}>
                              Không có khung giờ trực trống. Vui lòng chọn Stylist hoặc Ngày khác!
                            </div>
                          ) : (
                            <div className="ai-widget-slot-grid">
                              {rescheduleSlots.map(s => {
                                const timeStr = String(s.startTime || s).slice(0, 5);
                                return (
                                  <button 
                                    key={timeStr}
                                    className={`ai-widget-slot-btn ${rescheduleSelectedSlot === timeStr ? 'selected' : ''}`}
                                    onClick={() => setRescheduleSelectedSlot(timeStr)}
                                  >
                                    {timeStr}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Confirm / Close */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
                          <button
                            className="ai-widget-btn-secondary"
                            style={{ background: '#eee', color: '#666', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                            onClick={() => {
                              setReschedulingAptId(null);
                              setRescheduleInfo(null);
                            }}
                          >
                            Đóng
                          </button>
                          {rescheduleSelectedSlot && (
                            <button
                              disabled={rescheduleActionLoading}
                              className="ai-widget-btn-primary"
                              style={{ background: '#ff4778', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                              onClick={confirmReschedule}
                            >
                              {rescheduleActionLoading ? 'Đang cập nhật...' : `Xác nhận đổi sang ${rescheduleSelectedSlot}`}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget 2: MY_VOUCHERS
  if (type === 'MY_VOUCHERS') {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState('');

    useEffect(() => {
      const loadVouchers = async () => {
        try {
          const res = await axiosClient.get('/vouchers/my');
          const data = res.data.data || res.data || [];
          const active = data.filter(v => !v.UsedStatus && v.Status === 'ACTIVE');
          setVouchers(active);
        } catch {
          // silent
        } finally {
          setLoading(false);
        }
      };
      loadVouchers();
    }, []);

    const handleCopy = (code) => {
      navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 2000);
    };

    if (loading) return <div className="ai-chat-widget">⌛ Đang tải voucher...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">🎁 Voucher của bạn</div>
        {vouchers.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Bạn chưa có voucher nào khả dụng.</div>
        ) : (
          <div className="ai-widget-vch-list">
            {vouchers.map(v => (
              <div className="ai-widget-vch-card" key={v.VoucherId}>
                <strong>{v.DiscountType === 'PERCENT' ? `Giảm ${v.DiscountValue}%` : `Giảm ${Number(v.DiscountValue).toLocaleString('vi-VN')}đ`}</strong>
                <span className="code" onClick={() => handleCopy(v.Code)}>
                  {copied === v.Code ? 'Đã copy!' : v.Code}
                </span>
                <span className="exp">HSD: {v.EndDate ? new Date(v.EndDate).toLocaleDateString('vi-VN') : 'Không hạn'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget 3: SLOTS
  if (type === 'SLOTS') {
    const serviceId = args[0];
    const initialEmployeeId = args[1];
    const initialDate = args[2];

    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
    const [selectedDate, setSelectedDate] = useState('');
    const [slots, setSlots] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(true);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [notes, setNotes] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [aptId, setAptId] = useState(null);
    const [error, setError] = useState('');

    const [vouchers, setVouchers] = useState([]);
    const [selectedVoucherId, setSelectedVoucherId] = useState('');
    const [serviceDetail, setServiceDetail] = useState(null);

    // Fetch active vouchers for user on load
    useEffect(() => {
      const loadVouchers = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
          const res = await axiosClient.get('/vouchers/my');
          const data = res.data?.data || res.data || [];
          const active = data.filter(v => !v.UsedStatus && v.Status === 'ACTIVE');
          setVouchers(active);
        } catch (err) {
          console.error("Failed to load vouchers", err);
        }
      };
      loadVouchers();
    }, []);

    // Fetch service detail to get Price
    useEffect(() => {
      const loadServiceDetail = async () => {
        if (!serviceId) return;
        try {
          const res = await axiosClient.get('/services');
          const list = res.data?.data || res.data || [];
          const found = list.find(s => String(s.ServiceId) === String(serviceId));
          setServiceDetail(found || null);
        } catch (err) {
          console.error("Failed to fetch service detail", err);
        }
      };
      loadServiceDetail();
    }, [serviceId]);

    // Calculate discount amount
    const selectedVoucher = vouchers.find(v => String(v.VoucherId || v.voucherId) === String(selectedVoucherId));
    
    const calculatedDiscount = useMemo(() => {
      if (!selectedVoucher || !serviceDetail) return 0;
      const total = Number(serviceDetail.Price || 0);
      const type = String(selectedVoucher.DiscountType || selectedVoucher.discountType || '').toUpperCase();
      const value = Number(selectedVoucher.DiscountValue || selectedVoucher.discountValue || 0);
      const maxDiscount = Number(selectedVoucher.MaxDiscountAmount || selectedVoucher.maxDiscountAmount || 0);
      const minOrder = Number(selectedVoucher.MinOrderAmount || selectedVoucher.minOrderAmount || 0);

      if (total <= 0) return 0;
      if (minOrder > 0 && total < minOrder) return 0;

      let discountAmount = 0;
      if (type === 'PERCENT' || type === 'PERCENTAGE') {
        discountAmount = Math.round((total * value) / 100);
        if (maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
      } else {
        discountAmount = value;
      }
      return Math.min(discountAmount, total);
    }, [selectedVoucher, serviceDetail]);

    // Generate date options for next 7 days
    const dateOptions = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      let label = '';
      if (i === 0) label = 'Hôm nay';
      else if (i === 1) label = 'Ngày mai';
      else if (i === 2) label = 'Ngày kia';
      else {
        const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        label = daysOfWeek[d.getDay()];
      }
      
      dateOptions.push({
        date: dateStr,
        label: `${label} (${dd}/${mm})`
      });
    }

    // Set initial date
    useEffect(() => {
      if (initialDate && initialDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setSelectedDate(initialDate);
      } else {
        setSelectedDate(dateOptions[0].date);
      }
    }, [initialDate]);

    // Load employees for service
    useEffect(() => {
      const loadEmployees = async () => {
        if (!serviceId) return;
        try {
          setLoadingEmployees(true);
          const res = await axiosClient.get(`/employees/by-service/${serviceId}`);
          const list = res.data?.data || [];
          setEmployees(list);
          // If no initial employee, or suggested employee not in list, select the first one
          if (!selectedEmployeeId || !list.some(e => String(e.EmployeeId) === String(selectedEmployeeId))) {
            if (list.length > 0) {
              setSelectedEmployeeId(String(list[0].EmployeeId));
            }
          }
        } catch (err) {
          console.error("Failed to load employees for service", err);
        } finally {
          setLoadingEmployees(false);
        }
      };
      loadEmployees();
    }, [serviceId]);

    // Fetch slots when employee or date changes
    useEffect(() => {
      const loadSlots = async () => {
        if (!serviceId || !selectedEmployeeId || !selectedDate) return;
        try {
          setLoadingSlots(true);
          setSelectedSlot('');
          const res = await axiosClient.get('/appointments/available-slots', {
            params: { 
              serviceId, 
              employeeId: selectedEmployeeId, 
              appointmentDate: selectedDate 
            }
          });
          const data = res.data.data;
          const slotsList = data && typeof data === 'object' && !Array.isArray(data) ? data.slots : data;
          setSlots(slotsList || []);
        } catch (err) {
          setSlots([]);
        } finally {
          setLoadingSlots(false);
        }
      };
      loadSlots();
    }, [serviceId, selectedEmployeeId, selectedDate]);

    const handleConfirmBooking = async () => {
      if (!selectedSlot) return;
      try {
        setBookingLoading(true);
        setError('');

        const payload = {
          serviceId: Number(serviceId),
          employeeId: Number(selectedEmployeeId),
          appointmentDate: selectedDate,
          startTime: selectedSlot.length === 5 ? `${selectedSlot}:00` : selectedSlot,
          notes: notes
        };

        const res = await axiosClient.post('/appointments', payload);
        const data = res.data.data;
        const newAptId = data.AppointmentId || data.appointmentId || data.id;

        setAptId(newAptId);
        setBookingSuccess(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Đặt lịch thất bại.');
      } finally {
        setBookingLoading(false);
      }
    };

    if (loadingEmployees) return <div className="ai-chat-widget">⌛ Đang chuẩn bị dịch vụ...</div>;
    if (bookingSuccess) {
      return (
        <div className="ai-chat-widget">
          <div className="ai-widget-success">
            <span>🎉 Đặt lịch hẹn thành công lúc {selectedSlot} ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}!</span>
            <button 
              className="ai-widget-success-btn" 
              onClick={() => navigate(`/customer/payment/${aptId}?voucherId=${selectedVoucherId || ''}&discount=${calculatedDiscount}`)}
            >
              💳 Đến trang thanh toán
            </button>
          </div>
        </div>
      );
    }

    const selectedEmployee = employees.find(e => String(e.EmployeeId) === String(selectedEmployeeId));

    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">🕒 Chọn giờ hẹn trực tiếp</div>
        
        {/* Date chip selector */}
        <div className="ai-widget-date-selector">
          {dateOptions.map(opt => (
            <button
              key={opt.date}
              className={`ai-date-chip ${selectedDate === opt.date ? 'active' : ''}`}
              onClick={() => setSelectedDate(opt.date)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Stylist Selector */}
        {employees.length > 0 && (
          <div className="ai-widget-employee-selector-wrapper">
            <label className="ai-widget-label">Chọn Stylist:</label>
            <div className="ai-widget-employee-list">
              {employees.map(emp => (
                <div
                  key={emp.EmployeeId}
                  className={`ai-employee-card ${String(selectedEmployeeId) === String(emp.EmployeeId) ? 'active' : ''}`}
                  onClick={() => setSelectedEmployeeId(String(emp.EmployeeId))}
                >
                  <img 
                    src={resolveFileUrl(emp.ImageUrl || emp.AvatarUrl || emp.Avatar) || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'} 
                    alt={emp.FullName} 
                    className="ai-employee-avatar" 
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'; }}
                  />
                  <div className="ai-employee-info">
                    <span className="ai-employee-name">{emp.FullName}</span>
                    <span className="ai-employee-rating">⭐️ {Number(emp.AverageRating || 0).toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: '#d32f2f', fontSize: 12, marginBottom: 8, marginTop: 8 }}>{error}</div>}

        {/* Slots selection */}
        <div className="ai-widget-slots-section">
          {loadingSlots ? (
            <div className="ai-widget-slots-loading">⌛ Đang tìm giờ trống...</div>
          ) : slots.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b4f5a', padding: '10px 0' }}>
              Không có giờ trống cho Stylist {selectedEmployee?.FullName || ''} vào ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}. Vui lòng chọn Stylist hoặc Ngày khác!
            </div>
          ) : (
            <>
              <div className="ai-widget-slot-grid">
                {slots.map(s => {
                  const timeStr = String(s.startTime || s).slice(0, 5);
                  return (
                    <button 
                      key={timeStr}
                      className={`ai-widget-slot-btn ${selectedSlot === timeStr ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(timeStr)}
                    >
                      {timeStr}
                    </button>
                  );
                })}
              </div>
              {selectedSlot && (
                <div className="ai-widget-booking-form">
                  <input 
                    type="text" 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú cho stylist (không bắt buộc)..."
                  />
                  {vouchers.length > 0 && (
                    <div className="ai-widget-voucher-select-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label htmlFor="widget-voucher-select">🎁 Áp dụng Voucher (nếu có):</label>
                      <select
                        id="widget-voucher-select"
                        value={selectedVoucherId}
                        onChange={(e) => setSelectedVoucherId(e.target.value)}
                      >
                        <option value="">-- Không áp dụng voucher --</option>
                        {vouchers.map(v => {
                          const originalPrice = serviceDetail ? Number(serviceDetail.Price || 0) : 0;
                          const discountType = String(v.DiscountType || '').toUpperCase();
                          const valStr = discountType === 'PERCENT' || discountType === 'PERCENTAGE' ? `${v.DiscountValue}%` : `${Number(v.DiscountValue).toLocaleString('vi-VN')}đ`;
                          const desc = `${v.Code} (Giảm ${valStr})`;
                          return (
                            <option key={v.VoucherId} value={v.VoucherId}>
                              {desc}
                            </option>
                          );
                        })}
                      </select>
                      {calculatedDiscount > 0 && (
                        <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 2, fontWeight: 600 }}>
                          ✓ Được giảm: -{calculatedDiscount.toLocaleString('vi-VN')}đ (Giá tạm tính: {(Number(serviceDetail?.Price || 0) - calculatedDiscount).toLocaleString('vi-VN')}đ)
                        </div>
                      )}
                    </div>
                  )}
                  <button 
                    disabled={bookingLoading}
                    onClick={handleConfirmBooking}
                  >
                    {bookingLoading ? 'Đang đặt lịch...' : `🚀 Đặt lịch lúc ${selectedSlot}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Widget 4: SERVICE_HISTORY
  if (type === 'SERVICE_HISTORY') {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const loadHistory = async () => {
        try {
          const res = await axiosClient.get('/customers/me/service-history');
          const data = res.data.data || res.data || {};
          setHistory(data.items || []);
        } catch {
          // silent
        } finally {
          setLoading(false);
        }
      };
      loadHistory();
    }, []);

    if (loading) return <div className="ai-chat-widget">⌛ Đang tải lịch sử dịch vụ...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">📜 Lịch sử dịch vụ đã dùng</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Bạn chưa hoàn thành dịch vụ nào trên hệ thống.</div>
        ) : (
          <div className="ai-widget-hist-list">
            {history.map((h, i) => (
              <div className="ai-widget-hist-item" key={h.AppointmentId || i}>
                <div className="ai-widget-hist-info">
                  <strong>{h.ServiceName}</strong>
                  <span>Stylist: {h.EmployeeName || 'Bất kỳ'} · Chi nhánh: {h.BranchName}</span>
                  <span>Thời gian: {new Date(h.AppointmentDate).toLocaleDateString('vi-VN')}</span>
                </div>
                <div>
                  <b style={{ fontSize: 12, color: '#ff4778' }}>{Number(h.Price || 0).toLocaleString('vi-VN')}đ</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [showRecs, setShowRecs] = useState(true);
  
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync state to currentSession
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  const messages = useMemo(() => {
    return currentSession ? currentSession.messages : [];
  }, [currentSession]);

  // Load all sessions
  const loadSessions = async () => {
    const key = user 
      ? `ai_chat_workspace_sessions_${user.UserId || user.userId}` 
      : `ai_chat_workspace_sessions_guest`;
    
    let parsedSessions = [];
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        parsedSessions = JSON.parse(saved);
      } catch (err) {
        console.error("Failed to parse local sessions", err);
      }
    }

    // Pull from DB if logged in
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const [recRes, chatRes] = await Promise.all([
          axiosClient.get('/ai/my/recommendations'),
          axiosClient.get('/ai/my/chat'),
        ]);
        setRecommendations(recRes.data.data || recRes.data || []);
        
        const dbMessages = chatRes.data?.data || chatRes.data || [];
        if (dbMessages.length > 0) {
          const dbSessionIndex = parsedSessions.findIndex(s => s.id === 'session-database');
          const dbSession = {
            id: 'session-database',
            title: 'Hội thoại gần đây (Lịch sử)',
            messages: dbMessages
          };
          if (dbSessionIndex > -1) {
            parsedSessions[dbSessionIndex] = dbSession;
          } else {
            parsedSessions.unshift(dbSession);
          }
        }
      } catch (err) {
        console.error("Failed to load server chat logs", err);
      }
    }

    if (parsedSessions.length === 0) {
      const defaultSession = {
        id: `session-${Date.now()}`,
        title: 'Cuộc trò chuyện mới',
        messages: [] // Start empty/fresh
      };
      parsedSessions.push(defaultSession);
    }

    setSessions(parsedSessions);
    if (!currentSessionId || !parsedSessions.some(s => s.id === currentSessionId)) {
      setCurrentSessionId(parsedSessions[0].id);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [user]);

  // Sync to localStorage and broadcast sync event
  useEffect(() => {
    if (sessions.length > 0) {
      const key = user 
        ? `ai_chat_workspace_sessions_${user.UserId || user.userId}` 
        : `ai_chat_workspace_sessions_guest`;
      
      const savedStr = localStorage.getItem(key);
      const newStr = JSON.stringify(sessions);
      if (savedStr !== newStr) {
        localStorage.setItem(key, newStr);
        window.dispatchEvent(new CustomEvent('ai-chat-sync', { detail: newStr }));
      }
    }
  }, [sessions, user]);

  // Listen to sync broadcast
  useEffect(() => {
    const handleSync = (e) => {
      const newStr = e.detail;
      if (newStr && JSON.stringify(sessions) !== newStr) {
        try {
          const parsed = JSON.parse(newStr);
          setSessions(parsed);
        } catch (err) {
          console.error("Sync parse failed", err);
        }
      }
    };
    window.addEventListener('ai-chat-sync', handleSync);
    return () => window.removeEventListener('ai-chat-sync', handleSync);
  }, [sessions]);

  const handleCreateNewSession = () => {
    const activeSession = sessions.find(s => s.id === currentSessionId);
    if (activeSession && activeSession.messages.length === 0) {
      return;
    }

    const existingEmpty = sessions.find(s => s.messages.length === 0);
    if (existingEmpty) {
      setCurrentSessionId(existingEmpty.id);
      return;
    }

    const newSession = {
      id: `session-${Date.now()}`,
      title: 'Cuộc trò chuyện mới',
      messages: [] // empty list for fresh new chat
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const handleDeleteSession = async (sid, e) => {
    e.stopPropagation();

    // Prompts confirmation before deleting any session
    const targetSession = sessions.find(s => s.id === sid);
    const sessionName = targetSession ? targetSession.title : "cuộc trò chuyện này";
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${sessionName}"?`)) {
      return;
    }

    if (sid === 'session-database') {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          setLoading(true);
          await axiosClient.delete('/ai/my/chat');
        } catch (err) {
          console.error("Failed to delete database history", err);
        } finally {
          setLoading(false);
        }
      }
    }

    if (sessions.length <= 1) {
      const resetSession = {
        id: `session-${Date.now()}`,
        title: 'Cuộc trò chuyện mới',
        messages: []
      };
      setSessions([resetSession]);
      setCurrentSessionId(resetSession.id);
      return;
    }

    const filtered = sessions.filter(s => s.id !== sid);
    setSessions(filtered);
    if (currentSessionId === sid) {
      setCurrentSessionId(filtered[0].id);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const ask = async (text) => {
    const q = (text || question).trim();
    if (!q) return;
    setError('');

    const tempMsg = { ChatId: `temp-${Date.now()}`, Question: q, Answer: null, CreatedAt: new Date().toISOString() };
    
    // Add user question immediately
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, tempMsg] };
      }
      return s;
    }));
    setQuestion('');
    if (inputRef.current) inputRef.current.focus();

    try {
      setLoading(true);
      const res = await axiosClient.post('/ai/chat', { question: q });
      const data = res.data.data;
      
      // Update session with AI response and rename title if needed
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const newTitle = s.title === 'Cuộc trò chuyện mới' ? (q.length > 20 ? q.slice(0, 20) + '...' : q) : s.title;
          return {
            ...s,
            title: newTitle,
            messages: s.messages.map(m => m.ChatId === tempMsg.ChatId ? data : m)
          };
        }
        return s;
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: s.messages.filter(m => m.ChatId !== tempMsg.ChatId) };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    ask();
  };

  const handleSuggestion = (text) => {
    ask(text);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const handleChatClick = (e) => {
    const btn = e.target.closest('.chat-booking-btn');
    if (btn) {
      e.preventDefault();
      const href = btn.getAttribute('href');
      if (href) {
        navigate(href);
      }
    }
  };

  return (
    <CustomerLayout>
      <div className="ai-chat-page-workspace-container">
        
        {/* Sidebar Lịch sử trò chuyện */}
        <aside className="ai-chat-page-sidebar">
          <button 
            type="button" 
            className="ai-chat-page-new-btn"
            onClick={handleCreateNewSession}
          >
            ➕ Cuộc trò chuyện mới
          </button>
          
          <div className="ai-chat-page-sessions-list">
            {sessions.map(s => (
              <div 
                key={s.id} 
                className={`ai-chat-page-session-item ${currentSessionId === s.id ? 'active' : ''}`}
                onClick={() => setCurrentSessionId(s.id)}
              >
                <span className="session-title-text" style={{ fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                  💬 {s.title}
                </span>
                <button 
                  type="button" 
                  className="delete-session-btn" 
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  title="Xóa cuộc hội thoại này"
                  style={{ border: 'none', background: 'transparent', color: '#ff4778', cursor: 'pointer', fontSize: 12 }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Cửa sổ chat chính bên phải */}
        <div className="ai-chat-page-main">
          {/* Header */}
          <div className="ai-chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="eyebrow">✨ AI Assistant</div>
              <h2 className="section-title" style={{ margin: '4px 0 0 0' }}>Trợ lý AI Beauty Salon</h2>
              <p className="subtitle" style={{ margin: '4px 0 0 0' }}>Hỏi bất kỳ điều gì về dịch vụ, giá cả, đặt lịch — AI sẽ tư vấn cho bạn!</p>
            </div>
            {recommendations.length > 0 && (
              <button 
                type="button" 
                className="ai-toggle-recs-btn"
                onClick={() => setShowRecs(!showRecs)}
                style={{
                  padding: '8px 16px',
                  background: '#ffeef2',
                  border: '1px solid #ffccd7',
                  borderRadius: '20px',
                  color: '#e8396c',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(232, 57, 108, 0.05)'
                }}
              >
                {showRecs ? "✕ Ẩn gợi ý" : "💡 Hiện gợi ý dịch vụ"}
              </button>
            )}
          </div>

          <div className="ai-chat-container">
            {/* Chat Window */}
            <div className="ai-chat-window">
              <div className="ai-chat-messages" onClick={handleChatClick}>
                {messages.length === 0 && !loading && (
                  <div className="ai-welcome">
                    <div className="ai-welcome-icon">🤖</div>
                    <h3>Xin chào! 👋</h3>
                    <p>Mình là trợ lý AI của Beauty Salon. Hãy gửi câu hỏi đầu tiên để bắt đầu cuộc trò chuyện mới nhé!</p>
                  </div>
                )}

                {messages.map((m, idx) => {
                  const widget = m.Answer ? parseMessageWidget(m.Answer) : null;
                  let cleanAnswer = m.Answer || '';
                  if (widget) cleanAnswer = cleanAnswer.replace(widget.rawTag, '').trim();

                  let suggestions = [];
                  if (cleanAnswer) {
                    suggestions = parseMessageSuggestions(cleanAnswer);
                    cleanAnswer = cleanAnswer.replace(/\[\[SUGGESTIONS:[^\]]+\]\]/g, '').trim();
                  }

                  const isLast = idx === messages.length - 1;

                  return (
                    <div key={m.ChatId || `${m.Question}-${m.CreatedAt}`}>
                      {/* User message */}
                      {m.Question && (
                        <>
                          <div className="ai-msg user">
                            <div className="ai-msg-avatar">👤</div>
                            <div className="ai-msg-bubble">{m.Question}</div>
                          </div>
                          {m.CreatedAt && <div className="ai-msg-time" style={{ textAlign: 'right' }}>{formatTime(m.CreatedAt)}</div>}
                        </>
                      )}

                      {/* AI response */}
                      {cleanAnswer && (
                        <div className="ai-msg bot">
                          <div className="ai-msg-avatar">🤖</div>
                          <div
                            className="ai-msg-bubble"
                            dangerouslySetInnerHTML={{ __html: formatAIText(cleanAnswer) }}
                          />
                        </div>
                      )}

                      {/* Widget if exists */}
                      {widget && (
                        <AiChatWidget type={widget.type} args={widget.args} />
                      )}

                      {/* Suggestions chips */}
                      {isLast && !loading && suggestions.length > 0 && (
                        <div className="ai-quick-suggestions" style={{ marginLeft: '46px', marginTop: '8px' }}>
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="ai-suggestion-chip"
                              onClick={() => handleSuggestion(s)}
                            >
                              💬 {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {loading && !messages.some(m => m.Answer === null) && (
                  <div className="ai-typing">
                    <div className="ai-msg-avatar" style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff4778, #ff9ab7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, color: 'white', flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(255,71,120,0.25)'
                    }}>🤖</div>
                    <div className="ai-typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}

                {error && <div className="ai-error-toast">{error}</div>}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="ai-chat-input-area">
                <form className="ai-chat-form" onSubmit={handleSubmit}>
                  <input
                    ref={inputRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Nhập câu hỏi của bạn..."
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    className="ai-chat-send-btn"
                    disabled={loading || !question.trim()}
                    title="Gửi"
                  >
                    ➤
                  </button>
                </form>

                {/* Quick suggestions - only show when no messages */}
                {messages.length === 0 && (
                  <div className="ai-quick-suggestions">
                    {QUICK_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        className="ai-suggestion-chip"
                        onClick={() => handleSuggestion(s)}
                        disabled={loading}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && showRecs && (
              <div className="ai-recommendations">
                <h3>💡 Gợi ý dịch vụ cho bạn</h3>
                <div className="ai-rec-grid">
                  {recommendations.map((r, i) => (
                    <div className="ai-rec-card" key={r.RecommendationId || r.ServiceId || i}>
                      <strong>{r.ServiceName}</strong>
                      <span>{r.Reason || r.Description}</span>
                      {r.Price && <span style={{ color: '#ff4778', fontWeight: 700 }}>{Number(r.Price).toLocaleString('vi-VN')}đ • {r.DurationMinutes} phút</span>}
                      {r.ServiceId && (
                        <Link className="card-btn primary" to={`/customer/booking?serviceId=${r.ServiceId}`}>
                          Đặt lịch
                      </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </CustomerLayout>
  );
}
