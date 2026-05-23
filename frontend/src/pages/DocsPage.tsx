import { BookOpen, Copy, Check } from "lucide-react";
import { useState } from "react";

export function DocsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const card = {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
  };

  const codeBlock = (id: string, lang: string, code: string) => (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: "#666", fontSize: 11 }}>{lang}</span>
        <button onClick={() => copyCode(id, code)} style={{
          background: "transparent", border: "none", color: "#888", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4, fontSize: 11,
        }}>
          {copied === id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre style={{
        background: "#0a0a0a",
        border: "1px solid #1a1a1a",
        borderRadius: 8,
        padding: 16,
        overflow: "auto",
        fontSize: 13,
        lineHeight: 1.6,
        color: "#d4d4d4",
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="nmt_sk_your_key_here"
)

response = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[
        {"role": "user", "content": "Explain blockchain in one sentence"}
    ]
)

print(response.choices[0].message.content)`;

  const jsExample = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "nmt_sk_your_key_here",
});

const response = await client.chat.completions.create({
  model: "llama-3.2-3b",
  messages: [
    { role: "user", content: "Explain blockchain in one sentence" }
  ],
});

console.log(response.choices[0].message.content);`;

  const curlExample = `curl http://localhost:8000/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer nmt_sk_your_key_here" \\
  -d '{
    "model": "llama-3.2-3b",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`;

  const streamExample = `# Streaming is also supported
response = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[{"role": "user", "content": "Write a poem"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, color: "#eee", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <BookOpen size={24} color="#10b981" />
        API Documentation
      </h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        NeuralMint is fully compatible with the OpenAI SDK. Just change two lines.
      </p>

      {/* Quick Start */}
      <div style={card}>
        <h2 style={{ color: "#eee", marginBottom: 16, fontSize: 18 }}>Quick Start</h2>
        <div style={{ color: "#aaa", fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>1. Connect your wallet and get an API key from the <strong style={{ color: "#eee" }}>API Keys</strong> page</p>
          <p style={{ marginBottom: 8 }}>2. Fund your wallet with NMB tokens (mine them or swap on the DEX)</p>
          <p>3. Use the OpenAI SDK with your NeuralMint endpoint:</p>
        </div>
        {codeBlock("python", "Python", pythonExample)}
      </div>

      {/* JavaScript */}
      <div style={card}>
        <h2 style={{ color: "#eee", marginBottom: 16, fontSize: 18 }}>JavaScript / TypeScript</h2>
        {codeBlock("js", "JavaScript", jsExample)}
      </div>

      {/* cURL */}
      <div style={card}>
        <h2 style={{ color: "#eee", marginBottom: 16, fontSize: 18 }}>cURL</h2>
        {codeBlock("curl", "bash", curlExample)}
      </div>

      {/* Streaming */}
      <div style={card}>
        <h2 style={{ color: "#eee", marginBottom: 16, fontSize: 18 }}>Streaming</h2>
        {codeBlock("stream", "Python", streamExample)}
      </div>

      {/* Models */}
      <div style={card}>
        <h2 style={{ color: "#eee", marginBottom: 16, fontSize: 18 }}>Available Models</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
              {["Model", "Parameters", "Cost / 1K tokens", "Best for"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#888", fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { model: "llama-3.2-1b", params: "1B", cost: "0.001 NMB", use: "Simple tasks, fast responses" },
              { model: "llama-3.2-3b", params: "3B", cost: "0.003 NMB", use: "General purpose (default)" },
              { model: "llama-3.1-8b", params: "8B", cost: "0.008 NMB", use: "Complex reasoning" },
            ].map((row) => (
              <tr key={row.model} style={{ borderBottom: "1px solid #1a1a1a" }}>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#10b981", fontSize: 13 }}>{row.model}</td>
                <td style={{ padding: "10px 12px", color: "#eee", fontSize: 13 }}>{row.params}</td>
                <td style={{ padding: "10px 12px", color: "#f59e0b", fontSize: 13 }}>{row.cost}</td>
                <td style={{ padding: "10px 12px", color: "#888", fontSize: 13 }}>{row.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pricing */}
      <div style={card}>
        <h2 style={{ color: "#eee", marginBottom: 12, fontSize: 18 }}>How Pricing Works</h2>
        <div style={{ color: "#aaa", fontSize: 14, lineHeight: 1.8 }}>
          <p>NeuralMint charges per token (input + output), paid in NMB.</p>
          <p style={{ marginTop: 8 }}>Get NMB by:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4 }}>
            <li><strong style={{ color: "#eee" }}>Mining</strong> - Run the miner client to earn NMB by providing GPU compute</li>
            <li><strong style={{ color: "#eee" }}>Swapping</strong> - Trade MATIC for NMB on our built-in DEX</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
