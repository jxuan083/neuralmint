# Demo 截圖流程

## 前置條件
- Ollama 已安裝，模型 llama3.2:1b 已下載
- backend/.env 和 miner/.env 已建好
- miner/gpu_info.py 已修 bug（tuple → flat except）

## 啟動順序

```bash
# 1. 啟動 Ollama
ollama serve &

# 2. 啟動 Backend
cd /Users/pl/Desktop/neuralmint/backend
../.venv/bin/python main.py &

# 3. 在 backend DB 插入 demo API key（只需第一次）
cd /Users/pl/Desktop/neuralmint/backend
../.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from db.database import SessionLocal
from db.models import ApiKey
db = SessionLocal()
key = ApiKey(key='nmt_sk_demo_test_key_for_presentation_2026', name='demo-key', wallet_address='0x50a13d0e5ce58c0d8124653d3f9c2d25b325bbbc')
db.add(key)
db.commit()
db.close()
print('Key inserted')
"

# 4. 啟動 Miner
cd /Users/pl/Desktop/neuralmint/miner
../.venv/bin/python main.py &

# 5. 啟動 Frontend
cd /Users/pl/Desktop/neuralmint/frontend
npm run dev &

# 6. 打 API 製造數據（多打幾次讓 dashboard 有東西看）
curl -s http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer nmt_sk_demo_test_key_for_presentation_2026" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.2-1b","messages":[{"role":"user","content":"What is blockchain in one sentence?"}]}' | python3 -m json.tool

curl -s http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer nmt_sk_demo_test_key_for_presentation_2026" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.2-1b","messages":[{"role":"user","content":"Explain decentralized AI briefly."}]}' | python3 -m json.tool

curl -s http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer nmt_sk_demo_test_key_for_presentation_2026" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.2-1b","messages":[{"role":"user","content":"What is token economics?"}]}' | python3 -m json.tool
```

## 需要截的四張圖

1. **Code 對比** — 打開 1-code-comparison.py，用 VS Code 截圖，標出改的兩行
2. **Miner Terminal** — miner 跑起來後的 terminal 畫面（含 task completed）
3. **API Response** — curl 回傳的 JSON（格式跟 OpenAI 一模一樣）
4. **Dashboard** — 打開 http://localhost:5173（或實際 port）截用量統計畫面
