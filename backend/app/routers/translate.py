from fastapi import APIRouter, Depends
from app.schemas.schemas import TranslateReq
from app.services.ai_service import translate_text
from app.middleware.auth import require_auth, get_current_user
from app.middleware.ratelimit import check_ai_rate

router = APIRouter(prefix="/api/translate", tags=["Translate"])


@router.post("/")
async def api_translate(req: TranslateReq, current_user: dict = Depends(get_current_user)):
    check_ai_rate(current_user.get("username", "unknown"))
    return translate_text(text=req.text, source=req.source, target=req.target)
