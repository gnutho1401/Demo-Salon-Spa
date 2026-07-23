import { useCallback, useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";

function databasePayload(response) {
  const payload = response.data?.data || response.data;
  if (payload?.source !== "database" || !payload?.schemaVersion) {
    throw new Error("Nguồn dữ liệu báo cáo không hợp lệ");
  }
  return payload;
}

export function useAnalyticsDashboard(chartKeys, filter, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const keys = Array.isArray(chartKeys) ? chartKeys.join(",") : String(chartKeys || "");

  useEffect(() => {
    if (!enabled || !keys) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await axiosClient.get("/internal-analytics/dashboard", {
          params: { ...filter, keys },
          signal: controller.signal,
        });
        setData(databasePayload(response));
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        setError(requestError.response?.data?.message || requestError.message || "Không tải được dữ liệu báo cáo");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [enabled, filter, keys, reloadToken]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  const getChart = useCallback((chartKey) => data?.charts?.[chartKey] || null, [data]);
  return { data, loading, error, reload, getChart };
}

export async function exportInteractiveChart(chartKey, filter, format) {
  const response = await axiosClient.get(`/internal-analytics/charts/${chartKey}/export`, {
    params: { ...filter, format },
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"] || "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    || `${chartKey}.${format === "pdf" ? "pdf" : "xls"}`;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
