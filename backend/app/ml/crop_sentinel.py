"""
Crop Sentinel — MobileNetV2 Inference
Uzhavar AI · Pillar 1

Drop-in replacement for _stub_inference() in app/routers/diagnose.py.

Usage in diagnose.py (swap the stub block):
    from app.ml.crop_sentinel import infer
    result = await infer(contents)

Returns:
    {
        "disease_id"  : "tomato_early_blight",   # DB slug
        "name_en"     : "Tomato Early Blight",
        "name_ta"     : "தக்காளி முற்கால இலைக்கருகல் நோய்",
        "confidence"  : 0.94,
        "heatmap_key" : "diagnose/heatmap_<uuid>.png" | None
    }

Model files expected at (override via .env):
    CROP_SENTINEL_MODEL_PATH  = backend/models/crop_sentinel/crop_sentinel.pth
    CROP_SENTINEL_CLASSMAP    = backend/models/crop_sentinel/class_map.json

Copy your trained files:
    T:\\PROJECTS\\crop_sentinel\\model\\crop_sentinel.pth  →  backend/models/crop_sentinel/
    T:\\PROJECTS\\crop_sentinel\\model\\class_map.json     →  backend/models/crop_sentinel/
"""

import asyncio
import io
import json
import uuid
from functools import lru_cache
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from app.ml.disease_mapping import get_disease_meta

# ── Config ────────────────────────────────────────────────────────────────────

_BASE = Path(__file__).resolve().parents[3]  # → backend/

def _get_model_path() -> Path:
    import os
    p = os.getenv("CROP_SENTINEL_MODEL_PATH")
    return Path(p) if p else _BASE / "models" / "crop_sentinel" / "crop_sentinel.pth"

def _get_classmap_path() -> Path:
    import os
    p = os.getenv("CROP_SENTINEL_CLASSMAP")
    return Path(p) if p else _BASE / "models" / "crop_sentinel" / "class_map.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMG_SIZE     = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

_preprocess = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

# ── Singleton model loader ────────────────────────────────────────────────────

class _ModelBundle:
    def __init__(self):
        classmap_path = _get_classmap_path()
        model_path    = _get_model_path()

        if not classmap_path.exists():
            raise FileNotFoundError(
                f"class_map.json not found at {classmap_path}\n"
                f"Copy it from T:\\PROJECTS\\crop_sentinel\\model\\class_map.json"
            )
        if not model_path.exists():
            raise FileNotFoundError(
                f"crop_sentinel.pth not found at {model_path}\n"
                f"Copy it from T:\\PROJECTS\\crop_sentinel\\model\\crop_sentinel.pth"
            )

        with open(classmap_path, encoding="utf-8") as f:
            raw = json.load(f)
        # {str(idx): label} → list indexed by int
        self.class_map: list[str] = [raw[str(i)] for i in range(len(raw))]
        num_classes = len(self.class_map)

        # Rebuild exact same architecture used in train.py
        weights = models.MobileNet_V2_Weights.IMAGENET1K_V1
        net = models.mobilenet_v2(weights=None)
        in_feat = net.classifier[1].in_features
        net.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_feat, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.2),
            nn.Linear(512, num_classes),
        )
        net.load_state_dict(
            torch.load(model_path, map_location=DEVICE, weights_only=True)
        )
        net.eval()
        net.to(DEVICE)
        self.net = net

        print(
            f"[CropSentinel] Model loaded — {num_classes} classes on {DEVICE}"
        )


@lru_cache(maxsize=1)
def _get_bundle() -> _ModelBundle:
    return _ModelBundle()


# ── Core inference ────────────────────────────────────────────────────────────

def _run_inference(img_bytes: bytes) -> tuple[str, float]:
    """
    Synchronous CPU/GPU inference. Returns (label, confidence).
    """
    bundle = _get_bundle()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    tensor = _preprocess(img).unsqueeze(0).to(DEVICE)   # (1, 3, 224, 224)

    with torch.no_grad():
        logits = bundle.net(tensor)                       # (1, num_classes)
        probs  = torch.softmax(logits, dim=1)[0]

    top_idx   = int(probs.argmax())
    confidence = float(probs[top_idx])
    label      = bundle.class_map[top_idx]

    return label, confidence


# ── SHAP heatmap (optional) ───────────────────────────────────────────────────

def _generate_heatmap(img_bytes: bytes, media_dir: Path) -> str | None:
    """
    Generates a GradCAM-style SHAP heatmap overlay.
    Returns the relative media key (e.g. "diagnose/heatmap_<uuid>.png")
    or None if SHAP isn't installed / generation fails.
    """
    try:
        import shap
        import numpy as np
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        bundle = _get_bundle()
        img    = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        tensor = _preprocess(img).unsqueeze(0).to(DEVICE)

        # Use DeepExplainer on a small background batch derived from the input
        background = tensor.repeat(5, 1, 1, 1)
        explainer  = shap.DeepExplainer(bundle.net, background)
        shap_vals  = explainer.shap_values(tensor)      # list[num_classes] of (1,3,H,W)
        pred_idx   = int(
            torch.softmax(bundle.net(tensor), dim=1)[0].argmax()
        )

        # Collapse channels → single saliency map
        smap = np.abs(shap_vals[pred_idx][0]).sum(axis=0)   # (224, 224)
        smap = (smap - smap.min()) / (smap.max() - smap.min() + 1e-8)

        # Overlay on original image
        orig = np.array(img.resize((IMG_SIZE, IMG_SIZE))) / 255.0
        fig, ax = plt.subplots(1, 1, figsize=(4, 4))
        ax.imshow(orig)
        ax.imshow(smap, alpha=0.45, cmap="RdYlGn_r")
        ax.axis("off")

        heatmap_name = f"heatmap_{uuid.uuid4().hex}.png"
        dest = media_dir / heatmap_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(dest, bbox_inches="tight", pad_inches=0)
        plt.close(fig)

        return f"diagnose/{heatmap_name}"

    except Exception as exc:
        # SHAP is optional — log and continue without heatmap
        print(f"[CropSentinel] Heatmap skipped: {exc}")
        return None


# ── Public async API  (called by diagnose.py) ─────────────────────────────────

async def infer(img_bytes: bytes, *, generate_heatmap: bool = True) -> dict:
    """
    Main entry point.

    Parameters
    ----------
    img_bytes       : raw bytes from UploadFile.read()
    generate_heatmap: set False to skip SHAP (faster, for health checks)

    Returns
    -------
    dict with keys: disease_id, name_en, name_ta, confidence, heatmap_key
    """
    # Run blocking torch inference in a thread so we don't block the event loop
    loop   = asyncio.get_running_loop()
    label, confidence = await loop.run_in_executor(
        None, _run_inference, img_bytes
    )

    meta = get_disease_meta(label)   # KeyError → unmapped class (should never happen)

    heatmap_key = None
    if generate_heatmap:
        from app.config import get_settings
        media_dir = Path(get_settings().local_media_path) / "diagnose"
        heatmap_key = await loop.run_in_executor(
            None, _generate_heatmap, img_bytes, media_dir
        )

    return {
        "disease_id" : meta["disease_id"],
        "name_en"    : meta["name_en"],
        "name_ta"    : meta["name_ta"],
        "confidence" : confidence,
        "heatmap_key": heatmap_key,
    }