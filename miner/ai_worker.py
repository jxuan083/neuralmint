"""AI inference worker - calls Ollama to generate responses."""

import httpx
import config


async def run_inference(prompt: str, model: str = None) -> str:
    """Send prompt to Ollama and return the response."""
    model = model or config.OLLAMA_MODEL

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{config.OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")


async def check_ollama() -> bool:
    """Check if Ollama is running and the model is available."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{config.OLLAMA_URL}/api/tags")
            if resp.status_code != 200:
                return False
            models = resp.json().get("models", [])
            model_names = [m["name"] for m in models]
            if config.OLLAMA_MODEL not in model_names:
                # Try pulling the model
                print(f"[ai] Model {config.OLLAMA_MODEL} not found, available: {model_names}")
                return False
            return True
    except Exception:
        return False
