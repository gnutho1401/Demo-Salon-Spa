import { useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function dateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MembershipPage() {
  const [mine, setMine] = useState(null);
  const [levels, setLevels] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.all([
      axiosClient.get("/membership/my"),
      axiosClient.get("/membership"),
      axiosClient.get("/membership/my/history"),
    ])
      .then(([myRes, levelsRes, historyRes]) => {
        setMine(myRes.data?.data || myRes.data);
        setLevels(levelsRes.data?.data || levelsRes.data || []);
        setHistory(historyRes.data?.data || historyRes.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Không tải được điểm thưởng.");
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    return {
      earned: history
        .filter((x) => x.Type === "EARN")
        .reduce((sum, x) => sum + Number(x.Points || 0), 0),

      used: Math.abs(
        history
          .filter((x) => x.Type === "USE")
          .reduce((sum, x) => sum + Number(x.Points || 0), 0),
      ),

      earnCount: history.filter((x) => x.Type === "EARN").length,
      useCount: history.filter((x) => x.Type === "USE").length,
    };
  }, [history]);

  const needToNextLevel = mine?.NextLevelMinPoints
    ? Math.max(
        Number(mine.NextLevelMinPoints) - Number(mine.LoyaltyPoints || 0),
        0,
      )
    : 0;

  const progressPercent = mine?.NextLevelMinPoints
    ? Math.min(
        (Number(mine.LoyaltyPoints || 0) / Number(mine.NextLevelMinPoints)) *
          100,
        100,
      )
    : 100;

  return (
    <CustomerLayout>
      <div className="reward-page">
        <section className="reward-hero">
          <div>
            <span>LOYALTY REWARD</span>
            <h1>Điểm thưởng & hạng thành viên</h1>
            <p>
              Tích điểm sau mỗi lần thanh toán thành công và dùng điểm trực tiếp
              để giảm giá khi thanh toán lịch hẹn.
            </p>
          </div>

          <div className="reward-score">
            <b>{mine?.LoyaltyPoints || 0}</b>
            <span>điểm hiện có</span>
            <small>Hạng hiện tại: {mine?.LevelName || "Normal"}</small>
          </div>
        </section>

        {error && <div className="reward-alert error">{error}</div>}

        <section className="reward-stats">
          <div>
            <span>Điểm hiện có</span>
            <b>{mine?.LoyaltyPoints || 0}</b>
          </div>

          <div>
            <span>Đã tích lũy</span>
            <b>{summary.earned}</b>
          </div>

          <div>
            <span>Đã sử dụng</span>
            <b>{summary.used}</b>
          </div>

          <div>
            <span>Ưu đãi hạng</span>
            <b>{mine?.DiscountPercent || 0}%</b>
          </div>
        </section>

        <section className="reward-card">
          <h2>Tiến độ lên hạng</h2>

          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : mine?.NextLevelName ? (
            <>
              <div className="reward-progress">
                <span style={{ width: `${progressPercent}%` }} />
              </div>

              <p>
                Bạn cần thêm <b>{needToNextLevel}</b> điểm để lên hạng{" "}
                <b>{mine.NextLevelName}</b>.
              </p>
            </>
          ) : (
            <p>Bạn đang ở hạng cao nhất.</p>
          )}
        </section>

        <section className="reward-grid">
          {levels.map((level) => (
            <article
              className={`reward-level ${
                Number(level.MembershipLevelId) ===
                Number(mine?.MembershipLevelId)
                  ? "active"
                  : ""
              }`}
              key={level.MembershipLevelId}
            >
              <h3>{level.LevelName}</h3>
              <p>Từ {level.MinPoints} điểm</p>
              <b>Giảm {level.DiscountPercent}%</b>
              <small>{level.Description || "Không có mô tả."}</small>
            </article>
          ))}
        </section>

        <section className="reward-card">
          <h2>Lịch sử điểm thưởng</h2>

          {loading ? (
            <div className="reward-empty">Đang tải lịch sử điểm...</div>
          ) : history.length === 0 ? (
            <div className="reward-empty">Chưa có giao dịch điểm thưởng.</div>
          ) : (
            <div className="reward-history">
              {history.map((item) => (
                <article key={item.TransactionId}>
                  <div>
                    <b className={item.Type === "EARN" ? "plus" : "minus"}>
                      {item.Points > 0 ? "+" : ""}
                      {item.Points} điểm
                    </b>

                    <p>{item.Note}</p>

                    <small>
                      Lịch #{item.AppointmentId || "-"} · Thanh toán #
                      {item.PaymentId || "-"} · {dateTime(item.CreatedAt)}
                    </small>
                  </div>

                  <span>{money(item.Amount)}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </CustomerLayout>
  );
}
