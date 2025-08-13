import React, { useState } from "react";

export default function LinkAnalyzerForm() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "LINK_ANALYZER", input: { url } }),
      });
      if (!res.ok) throw new Error("Erro ao chamar o endpoint: " + res.status);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleAnalyze} style={{ margin: "2em 0" }}>
      <label>
        URL para analisar:
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          style={{ marginLeft: 8, minWidth: 300 }}
          placeholder="https://exemplo.com"
        />
      </label>
      <button type="submit" disabled={loading} style={{ marginLeft: 12 }}>
        {loading ? "Analisando..." : "Analisar"}
      </button>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      {result && (
        <pre style={{ marginTop: 16, background: "#f6f8fa", padding: 12, borderRadius: 6 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </form>
  );
}
