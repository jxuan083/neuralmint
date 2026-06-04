# ===== OpenAI（原本的寫法） =====

from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxxxxxxxxxx",       # OpenAI API key
)

resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What is blockchain?"}],
)
print(resp.choices[0].message.content)


# ===== NeuralMint（只改兩行） =====

from openai import OpenAI

client = OpenAI(
    base_url="https://api.neuralmint.io/v1",  # ← 改這行
    api_key="nmt_sk_...",                      # ← 改這行
)

resp = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[{"role": "user", "content": "What is blockchain?"}],
)
print(resp.choices[0].message.content)
