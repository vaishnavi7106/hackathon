"""Single switch between Gemini Vision and MobileNetV2 inference.

Set INFERENCE_ENGINE=gemini  (or =mobilenet) in .env.
diagnose.py calls only run_inference() — never the engine modules directly.
"""

from app.config import get_settings


async def run_inference(image_bytes: bytes, crop: str | None) -> dict:
    """Route to Gemini or MobileNet based on INFERENCE_ENGINE setting.

    Return dict always contains at minimum:
        source           "gemini_vision" | "ml_model" | "mobilenet_fallback"
        confidence       float

    Gemini results also contain:
        confidence_level  "high" | "medium" | "low"
        disease_name_en / disease_name_ta
        is_healthy, symptoms_observed, modern_treatment, indigenous_treatment

    MobileNet results also contain:
        disease_id, name_en, name_ta, top3, filtered, n_classes, heatmap_key
    """
    engine = get_settings().inference_engine.lower()

    if engine == "gemini":
        try:
            from app.ml.gemini_vision import infer_gemini
            return await infer_gemini(image_bytes, crop or "")
        except Exception as exc:
            import structlog
            structlog.get_logger().warning("gemini_fallback", reason=str(exc)[:200])
            # fall through to MobileNet below

    # engine == "mobilenet" (default when not set)
    from app.ml.crop_sentinel import infer as _mobilenet
    result = await _mobilenet(image_bytes, crop_filter=crop)
    result["source"] = "ml_model"
    return result
