import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field
from openai import OpenAI
import httpx

# =========== Config ===========
API_KEY = os.getenv("SAFEAI_API_KEY", "sk-safeai-dfa2d649b8d1b5c974a5f72e97575e3d6b604d5f7ade2ce1")
BASE_URL = "https://safeai613.com/v1"

# =========== FastAPI Setup ===========
app = FastAPI(title="SafeAI API", version="1.0.0")


# =========== CORS Middleware ===========
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",  # הכתובת של אפליקציית Angular
        "http://localhost:5173",  # Vite development server
        "http://localhost:3000",  # Another common dev port
        "http://127.0.0.1:4200",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========== Models ===========
class ChatMessage(BaseModel):
    """הודעת צ'אט אחת בשרשור."""
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class RequestModel(BaseModel):
    model: str = "gpt-4o-mini"
    # כל ההיסטוריה של השיחה, לפי הסדר. ההודעה האחרונה היא של המשתמש.
    messages: list[ChatMessage] = Field(min_length=1)


class ResponseModel(BaseModel):
    output_text: str
    model: str


# =========== Initialize Client ===========
httpx_client = httpx.Client(http2=True, verify=False)

client = OpenAI(
    base_url=BASE_URL,
    api_key=API_KEY,
    http_client=httpx_client
)

# =========== Routes ===========
@app.post("/generate", response_model=ResponseModel)
async def generate_content(request: RequestModel):
    """
    Generate content using SafeAI API, with full conversation context.
    """
    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="SAFEAI_API_KEY is not set in the environment",
        )

    try:
        response = client.responses.create(
            model=request.model,
            # responses API מקבל מערך של {role, content} — כלומר כל השרשור
            input=[m.model_dump() for m in request.messages],
        )
        return ResponseModel(
            output_text=response.output_text,
            model=request.model
        )
    except Exception as e:
        print(f"--- SafeAI error ---")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {e}")
        resp = getattr(e, "response", None)
        if resp is not None:
            print(f"HTTP status: {resp.status_code}")
            print(f"Headers: {dict(resp.headers)}")
            print(f"Body: {resp.text}")
        print(f"--------------------")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy"}

# =========== Shutdown Event ===========
@app.on_event("shutdown")
async def shutdown_event():
    """
    Close httpx client on shutdown
    """
    httpx_client.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
