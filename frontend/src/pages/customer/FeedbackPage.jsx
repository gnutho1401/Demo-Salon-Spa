import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

export default function FeedbackPage() {
  const [searchParams] = useSearchParams();
  const [feedbacks, setFeedbacks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewableServices, setReviewableServices] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ subject: '', content: '' });
  const [reviewForm, setReviewForm] = useState({ appointmentId: '', serviceId: '', rating: 5, comment: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    const [fbRes, rvRes, apRes] = await Promise.all([
      axiosClient.get('/customers/me/feedbacks'),
      axiosClient.get('/customers/me/reviews'),
      axiosClient.get('/customers/me/reviewable-services'),
    ]);
    setFeedbacks(fbRes.data.data || fbRes.data || []);
    setReviews(rvRes.data.data || rvRes.data || []);
    const items = apRes.data.data || apRes.data || [];
    setReviewableServices(items);
    const appointmentId = searchParams.get('appointmentId');
    const matched = items.find((a) => String(a.AppointmentId) === String(appointmentId));
    if (matched) {
      setReviewForm((prev) => ({ ...prev, appointmentId: matched.AppointmentId, serviceId: matched.ServiceId }));
    }
  };

  useEffect(() => { load().catch(() => {}); }, [searchParams]);

  const submitFeedback = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/customers/me/feedbacks', feedbackForm);
      setMessage('Gửi phản hồi thành công');
      setFeedbackForm({ subject: '', content: '' });
      load();
    } catch (err) { setMessage(err.response?.data?.message || 'Gửi phản hồi thất bại'); }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      const selected = reviewableServices.find((a) => String(a.AppointmentId) === String(reviewForm.appointmentId) && String(a.ServiceId) === String(reviewForm.serviceId));
      if (!selected) throw new Error('Chỉ được đánh giá dịch vụ đã hoàn thành và chưa đánh giá');
      await axiosClient.post('/customers/me/reviews', reviewForm);
      setMessage('Gửi đánh giá thành công');
      setReviewForm({ appointmentId: '', serviceId: '', rating: 5, comment: '' });
      load();
    } catch (err) { setMessage(err.response?.data?.message || 'Gửi đánh giá thất bại'); }
  };

  return <CustomerLayout>
    <div className="section-head"><div><div className="eyebrow">Experience</div><h2 className="section-title">Phản hồi / đánh giá</h2></div></div>
    {message && <div className="alert success">{message}</div>}

    <div className="customer-two-columns">
      <form className="dashboard-card profile-form" onSubmit={submitFeedback}>
        <h3>Gửi phản hồi / khiếu nại</h3>
        <div className="form-group"><label>Tiêu đề</label><input value={feedbackForm.subject} onChange={(e) => setFeedbackForm({ ...feedbackForm, subject: e.target.value })} /></div>
        <div className="form-group"><label>Nội dung</label><textarea value={feedbackForm.content} onChange={(e) => setFeedbackForm({ ...feedbackForm, content: e.target.value })} /></div>
        <button className="btn">Gửi phản hồi</button>
      </form>

      <form className="dashboard-card profile-form" onSubmit={submitReview}>
        <h3>Đánh giá dịch vụ đã trải nghiệm</h3>
        <div className="form-group"><label>Dịch vụ đã trải nghiệm</label><select value={`${reviewForm.appointmentId}|${reviewForm.serviceId}`} onChange={(e) => {
          const [appointmentId, serviceId] = e.target.value.split('|');
          setReviewForm({ ...reviewForm, appointmentId, serviceId });
        }}>
          <option value="|">Chọn dịch vụ</option>
          {reviewableServices.map((a) => <option key={`${a.AppointmentId}-${a.ServiceId}`} value={`${a.AppointmentId}|${a.ServiceId}`}>{a.ServiceName} - {a.EmployeeName} - {String(a.StartTime || '').slice(0,5)}</option>)}
        </select></div>
        <div className="form-group"><label>Số sao</label><select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} sao</option>)}</select></div>
        <div className="form-group"><label>Bình luận</label><textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} /></div>
        <button className="btn">Gửi đánh giá</button>
      </form>
    </div>

    <div className="customer-two-columns">
      <div className="dashboard-card"><h3>Phản hồi đã gửi</h3>{feedbacks.map((f) => <div className="mini-item" key={f.FeedbackId}><strong>{f.Subject}</strong><span>{f.Content}</span><span className="status">{f.Status}</span></div>)}</div>
      <div className="dashboard-card"><h3>Đánh giá đã gửi</h3>{reviews.map((r) => <div className="mini-item" key={r.ReviewId}><strong>{r.ServiceName || `Lịch #${r.AppointmentId}`}</strong><span>{r.Rating} sao - {r.Comment}</span></div>)}</div>
    </div>
  </CustomerLayout>;
}
