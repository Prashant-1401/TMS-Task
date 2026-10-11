from fastapi import APIRouter, Depends
from app.schemas.schemas import MeetingReviewReq, ParagraphAnalysisReq
from app.services.ai_service import extract_insights, analyze_paragraph
from app.middleware.auth import require_auth, get_current_user
from app.middleware.ratelimit import check_ai_rate

router = APIRouter(prefix="/api/meetings", tags=["Meeting AI"])


@router.post("/extract-insights")
async def api_extract_insights(req: MeetingReviewReq, current_user: dict = Depends(get_current_user)):
    check_ai_rate(current_user.get("username", "unknown"))
    return extract_insights(
        transcript=req.transcript,
        meeting_type=req.meeting_type,
        plant=req.plant,
        previous_actions=req.previous_actions,
    )


@router.post("/analyze-paragraph")
async def api_analyze_paragraph(req: ParagraphAnalysisReq, current_user: dict = Depends(get_current_user)):
    check_ai_rate(current_user.get("username", "unknown"))
    return analyze_paragraph(
        paragraph=req.paragraph,
        meeting_type=req.meeting_type,
        source_lang=req.source_lang,
    )
