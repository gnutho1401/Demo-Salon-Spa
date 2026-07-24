"""Discover openly licensed hairstyle images and build a rights-review queue.

Openverse is a discovery index, not a warranty of copyright or personality
rights. Therefore this script never marks internet images as training-approved.
It downloads candidates, preserves attribution evidence, deduplicates them and
creates a manifest that must pass a separate rights review before LoRA training.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError

API_URL = "https://api.openverse.org/v1/images/"
USER_AGENT = "LunaSalonHairDatasetBuilder/1.0 (+local research pipeline)"
ALLOWED_LICENSES = {"cc0", "pdm", "by"}
MAX_IMAGE_BYTES = 12 * 1024 * 1024

STYLES: tuple[dict[str, Any], ...] = (
    {
        "code": "BUTTERFLY_LAYERS_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_butterfly_2026",
        "queries": ("butterfly haircut", "female layered haircut portrait"),
        "caption": "female butterfly layers haircut, natural face framing layers, realistic hairline and strands",
    },
    {
        "code": "GRADUATED_BOB_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_graduated_bob_2026",
        "queries": ("graduated bob haircut", "bob haircut portrait"),
        "caption": "female graduated bob haircut, soft stacked shape, natural salon texture and hairline",
    },
    {
        "code": "BIXIE_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_bixie_2026",
        "queries": ("bixie haircut", "female pixie bob haircut"),
        "caption": "female bixie haircut, blended bob and pixie shape, realistic short strands and soft edges",
    },
    {
        "code": "SOFT_SHAG_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_soft_shag_2026",
        "queries": ("soft shag haircut", "female shag haircut portrait"),
        "caption": "female soft shag haircut, airy layers, natural movement, realistic individual strands",
    },
    {
        "code": "SOFT_MODERN_MULLET_2026",
        "audience": "MALE",
        "trigger": "hairtrend_soft_mullet_2026",
        "queries": ("soft modern mullet haircut", "male mullet haircut"),
        "caption": "male soft modern mullet haircut, relaxed texture, natural temple transition and hairline",
    },
    {
        "code": "TEXTURED_CROP_TAPER_2026",
        "audience": "MALE",
        "trigger": "hairtrend_crop_taper_2026",
        "queries": ("textured crop taper haircut", "male crop haircut portrait"),
        "caption": "male textured crop taper, natural short strands, soft taper and believable temple hairline",
    },
    {
        "code": "CURTAIN_FLOW_2026",
        "audience": "MALE",
        "trigger": "hairtrend_curtain_flow_2026",
        "queries": ("curtain flow haircut", "male curtain haircut portrait"),
        "caption": "male curtain flow haircut, natural center part, realistic volume and strand movement",
    },
    {
        "code": "BURST_FADE_MULLET_2026",
        "audience": "MALE",
        "trigger": "hairtrend_burst_mullet_2026",
        "queries": ("burst fade mullet haircut", "male fade mullet haircut"),
        "caption": "male burst fade mullet, soft fade transition, textured top and realistic hair density",
    },
    {
        "code": "MODERN_BUZZ_2026",
        "audience": "MALE",
        "trigger": "hairtrend_modern_buzz_2026",
        "queries": ("modern buzz cut haircut", "male buzz cut portrait"),
        "caption": "male modern buzz cut, subtle gradient, realistic scalp visibility and natural hairline",
    },
    {
        "code": "NATURAL_CURL_TAPER_2026",
        "audience": "MALE",
        "trigger": "hairtrend_curl_taper_2026",
        "queries": ("natural curl taper haircut", "male curly haircut portrait"),
        "caption": "male natural curl taper, defined natural curls, soft side taper and realistic density",
    },
    {
        "code": "COPPER_ROSE_2026",
        "audience": "UNISEX",
        "trigger": "hairtrend_copper_rose_2026",
        "queries": ("copper rose hair", "copper hair portrait"),
        "caption": "copper rose hair color, warm brunette depth, subtle rose highlights and realistic salon light",
    },
    {
        "code": "BOX_BOB_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_box_bob_2026",
        "queries": ("box bob haircut", "female blunt bob portrait"),
        "caption": "female box bob haircut, clean chin-length outline, full ends and realistic strand variation",
    },
    {
        "code": "BUTTERFLY_BOB_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_butterfly_bob_2026",
        "queries": ("butterfly bob haircut", "female layered bob portrait"),
        "caption": "female butterfly bob, cheek-framing feathered layers, rounded volume and natural flipped ends",
    },
    {
        "code": "CURVED_BOB_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_curved_bob_2026",
        "queries": ("curved bob haircut", "female rounded bob portrait"),
        "caption": "female curved bob, jaw-skimming rounded silhouette, inward bend and healthy dimensional shine",
    },
    {
        "code": "FRAGMENTED_BOB_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_fragmented_bob_2026",
        "queries": ("fragmented bob haircut", "female choppy bob portrait"),
        "caption": "female fragmented bob, softly disconnected ends, airy piecey texture and realistic flyaways",
    },
    {
        "code": "MODERN_RACHEL_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_modern_rachel_2026",
        "queries": ("modern Rachel haircut", "female face framing layers portrait"),
        "caption": "female modern Rachel haircut, heart-shaped layers, cheekbone volume and healthy dense lengths",
    },
    {
        "code": "COLLARBONE_LOB_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_collarbone_lob_2026",
        "queries": ("collarbone lob haircut", "female long bob portrait"),
        "caption": "female collarbone lob, strong shoulder-skimming outline, invisible layers and full natural ends",
    },
    {
        "code": "COWBOY_BOB_2026",
        "audience": "FEMALE",
        "trigger": "hairtrend_cowboy_bob_2026",
        "queries": ("cowboy bob haircut", "female shaggy bob portrait"),
        "caption": "female cowboy bob, relaxed jaw-length shaggy layers, long fringe and lived-in texture",
    },
    {
        "code": "HEARTTHROB_FLOW_2026",
        "audience": "MALE",
        "trigger": "hairtrend_heartthrob_flow_2026",
        "queries": ("heartthrob haircut men", "male 90s flow haircut portrait"),
        "caption": "male heartthrob flow, medium layered shape, softly parted fringe and realistic hairline",
    },
    {
        "code": "HIGH_TOP_FADE_2026",
        "audience": "MALE",
        "trigger": "hairtrend_high_top_fade_2026",
        "queries": ("high top fade haircut", "male high fade portrait"),
        "caption": "male modern high-top fade, natural textured top, clean graduated sides and realistic density",
    },
    {
        "code": "CREW_CUT_TAPER_2026",
        "audience": "MALE",
        "trigger": "hairtrend_crew_taper_2026",
        "queries": ("crew cut taper haircut", "male crew cut portrait"),
        "caption": "male crew cut with low taper, short textured top and believable scalp transition",
    },
    {
        "code": "TEXTURED_BOWL_2026",
        "audience": "MALE",
        "trigger": "hairtrend_textured_bowl_2026",
        "queries": ("textured bowl haircut men", "male bowl cut portrait"),
        "caption": "male modern textured bowl cut, softened fringe, layered perimeter and natural piecey strands",
    },
    {
        "code": "BRO_FLOW_2026",
        "audience": "MALE",
        "trigger": "hairtrend_bro_flow_2026",
        "queries": ("bro flow haircut", "male swept back medium hair portrait"),
        "caption": "male natural bro flow, medium swept-back layers, relaxed waves and realistic flyaways",
    },
    {
        "code": "CHAMPAGNE_BRUNETTE_2026",
        "audience": "UNISEX",
        "trigger": "hairtrend_champagne_brunette_2026",
        "queries": ("champagne brunette hair", "beige brunette hair portrait"),
        "caption": "champagne brunette, natural roots, muted beige highlights and dimensional healthy shine",
    },
    {
        "code": "CHERRY_MOCHA_2026",
        "audience": "UNISEX",
        "trigger": "hairtrend_cherry_mocha_2026",
        "queries": ("cherry mocha hair", "dark red brunette hair portrait"),
        "caption": "deep cherry mocha brunette, subtle red-copper undertone, dimensional lowlights and natural roots",
    },
    {
        "code": "TOASTED_COPPER_2026",
        "audience": "UNISEX",
        "trigger": "hairtrend_toasted_copper_2026",
        "queries": ("toasted copper hair", "copper balayage hair portrait"),
        "caption": "toasted copper balayage, soft warm highlights, brunette root melt and realistic strand depth",
    },
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a licensed hairstyle discovery queue from Openverse.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--per-style", type=int, default=4)
    parser.add_argument("--page-size", type=int, default=20)
    parser.add_argument("--licenses", default="cc0,pdm,by")
    parser.add_argument("--min-side", type=int, default=512)
    parser.add_argument("--request-delay", type=float, default=0.35)
    parser.add_argument("--api-token", default="")
    parser.add_argument("--analyzer-url", default="http://127.0.0.1:8189/v1/analyze")
    parser.add_argument("--analyzer-token", default="")
    parser.add_argument("--min-quality", type=float, default=0.45)
    parser.add_argument("--skip-analysis", action="store_true")
    return parser.parse_args()


def request(url: str, token: str = "", timeout: int = 20) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json,image/*;q=0.9,*/*;q=0.5"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as response:
        length = int(response.headers.get("Content-Length") or 0)
        if length > MAX_IMAGE_BYTES:
            raise ValueError(f"remote file exceeds {MAX_IMAGE_BYTES} bytes")
        data = response.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError(f"download exceeds {MAX_IMAGE_BYTES} bytes")
        return data


def request_json(url: str, token: str) -> dict[str, Any]:
    return json.loads(request(url, token).decode("utf-8"))


def analyze_candidate(payload: bytes, url: str, token: str) -> dict[str, Any]:
    body = json.dumps({
        "image_base64": base64.b64encode(payload).decode("ascii"),
        "mime_type": "image/jpeg",
    }).encode("utf-8")
    headers = {"User-Agent": USER_AGENT, "Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request_object = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(request_object, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def average_hash(image: Image.Image) -> str:
    gray = ImageOps.grayscale(image).resize((16, 16), Image.Resampling.LANCZOS)
    pixels = list(gray.get_flattened_data() if hasattr(gray, "get_flattened_data") else gray.getdata())
    average = sum(pixels) / max(1, len(pixels))
    bits = "".join("1" if value >= average else "0" for value in pixels)
    return f"{int(bits, 2):064x}"


def hamming(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def extension_for(format_name: str) -> str:
    return ".png" if format_name.upper() == "PNG" else ".jpg"


def verify_license_metadata(item: dict[str, Any], allowlist: set[str]) -> tuple[bool, str]:
    license_code = str(item.get("license") or "").lower()
    license_url = str(item.get("license_url") or "")
    source_url = str(item.get("foreign_landing_url") or "")
    if license_code not in allowlist:
        return False, f"license {license_code or 'missing'} is not allowed"
    if not license_url.startswith("https://"):
        return False, "license_url is missing or not HTTPS"
    if not source_url.startswith("http"):
        return False, "source landing page is missing"
    if license_code in {"cc0", "by"} and "creativecommons.org/" not in license_url:
        return False, "Creative Commons license URL is inconsistent"
    if license_code == "pdm" and not any(host in license_url for host in ("creativecommons.org/", "rightsstatements.org/")):
        return False, "public-domain license URL is inconsistent"
    return True, ""


def download_candidate(item: dict[str, Any], token: str, min_side: int) -> tuple[bytes, Image.Image]:
    urls = [str(item.get("url") or "")]
    thumbnail = str(item.get("thumbnail") or "")
    if thumbnail:
        separator = "&" if "?" in thumbnail else "?"
        urls.append(f"{thumbnail}{separator}full_size=true")
    failures = []
    for url in filter(None, urls):
        try:
            payload = request(url, token)
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(payload))).convert("RGB")
            if min(image.size) < min_side:
                raise ValueError(f"image is only {image.width}x{image.height}")
            return payload, image
        except (OSError, ValueError, UnidentifiedImageError, urllib.error.URLError) as error:
            failures.append(str(error))
    raise ValueError("; ".join(failures) or "no downloadable image URL")


def main() -> None:
    args = parse_args()
    output = args.output.resolve()
    source_root = output / "source"
    source_root.mkdir(parents=True, exist_ok=True)
    licenses = {item.strip().lower() for item in args.licenses.split(",") if item.strip()}
    if not licenses or not licenses.issubset(ALLOWED_LICENSES):
        raise ValueError(f"Licenses must be a subset of {sorted(ALLOWED_LICENSES)}")

    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    search_stats: list[dict[str, Any]] = []
    seen_sha: set[str] = set()
    seen_hashes: list[str] = []

    for style in STYLES:
        style_count = 0
        for discovery_query in style["queries"]:
            query = urllib.parse.urlencode({
                "q": discovery_query,
                "license": ",".join(sorted(licenses)),
                "license_type": "commercial,modification",
                "mature": "false",
                "page_size": max(args.page_size, args.per_style * 3),
                "page": 1,
            })
            try:
                search = request_json(f"{API_URL}?{query}", args.api_token)
            except Exception as error:  # noqa: BLE001 - every failed source must be reported.
                rejected.append({
                    "style_code": style["code"],
                    "discovery_query": discovery_query,
                    "reason": f"search failed: {error}",
                })
                continue
            results = search.get("results") or []
            search_stats.append({
                "style_code": style["code"],
                "query": discovery_query,
                "result_count": search.get("result_count", len(results)),
                "page_results": len(results),
            })

            for item in results:
                if style_count >= args.per_style:
                    break
                source_id = str(item.get("id") or "")
                valid_license, reason = verify_license_metadata(item, licenses)
                if not valid_license:
                    rejected.append({"source_id": source_id, "style_code": style["code"], "reason": reason})
                    continue
                try:
                    payload, image = download_candidate(item, args.api_token, args.min_side)
                    sha256 = hashlib.sha256(payload).hexdigest()
                    perceptual = average_hash(image)
                    if sha256 in seen_sha or any(hamming(perceptual, known) <= 5 for known in seen_hashes):
                        raise ValueError("duplicate or near-duplicate image")

                    analysis: dict[str, Any] = {"status": "SKIPPED"}
                    if not args.skip_analysis:
                        analysis = analyze_candidate(payload, args.analyzer_url, args.analyzer_token)
                        if analysis.get("is_face") is not True:
                            raise ValueError("local analyzer did not find a clear face")
                        if analysis.get("is_frontal") is not True:
                            raise ValueError(
                                f"local analyzer rejected non-frontal pose ({analysis.get('pose_score')})"
                            )
                        if float(analysis.get("quality_score") or 0) < args.min_quality:
                            raise ValueError(
                                f"local analyzer quality {analysis.get('quality_score')} is below {args.min_quality}"
                            )

                    seen_sha.add(sha256)
                    seen_hashes.append(perceptual)
                    folder = source_root / style["audience"].lower() / style["code"].lower()
                    folder.mkdir(parents=True, exist_ok=True)
                    relative = Path("source") / style["audience"].lower() / style["code"].lower()
                    filename = f"{source_id or sha256[:16]}{extension_for(image.format or 'JPEG')}"
                    image_path = folder / filename
                    image.save(image_path, "JPEG", quality=95, subsampling=0)

                    license_code = str(item.get("license") or "").lower()
                    record = {
                        "image_path": (relative / filename).as_posix(),
                        "caption": f"{style['trigger']}, {style['caption']}",
                        "audience": style["audience"],
                        "style_code": style["code"],
                        "discovery_query": discovery_query,
                        "consent": False,
                        "license": license_code.upper(),
                        "license_url": item.get("license_url"),
                        "source_url": item.get("foreign_landing_url"),
                        "creator": item.get("creator"),
                        "creator_url": item.get("creator_url"),
                        "attribution": item.get("attribution"),
                        "source_id": source_id,
                        "provider": item.get("provider"),
                        "source": item.get("source"),
                        "sha256": sha256,
                        "perceptual_hash": perceptual,
                        "analysis": analysis,
                        "rights_basis": "OPEN_LICENSE_DISCOVERY",
                        "rights_metadata_complete": True,
                        "rights_verified": False,
                        "personality_rights_verified": False,
                        "style_verified": False,
                        "training_approved": False,
                        "discovered_at": datetime.now(timezone.utc).isoformat(),
                    }
                    accepted.append(record)
                    style_count += 1
                except Exception as error:  # noqa: BLE001
                    rejected.append({
                        "source_id": source_id,
                        "style_code": style["code"],
                        "discovery_query": discovery_query,
                        "source_url": item.get("foreign_landing_url"),
                        "reason": str(error),
                    })
                time.sleep(max(0.0, args.request_delay))
            if style_count >= args.per_style:
                break

    manifest = output / "manifest.discovery.jsonl"
    manifest.write_text(
        "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in accepted),
        encoding="utf-8",
    )
    rejects = output / "rejected.jsonl"
    rejects.write_text(
        "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in rejected),
        encoding="utf-8",
    )
    with (output / "attribution.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "source_id", "style_code", "creator", "source_url", "license", "license_url", "attribution",
        ])
        writer.writeheader()
        for item in accepted:
            writer.writerow({key: item.get(key) for key in writer.fieldnames})

    counts = {
        audience: sum(item["audience"] == audience for item in accepted)
        for audience in ("MALE", "FEMALE", "UNISEX")
    }
    report = {
        "status": "REVIEW_REQUIRED" if accepted else "NO_CANDIDATES",
        "accepted_for_review": len(accepted),
        "training_approved": 0,
        "rejected": len(rejected),
        "audience_counts": counts,
        "search_stats": search_stats,
        "manifest": str(manifest),
        "notice": (
            "Openverse metadata is discovery evidence only. Verify copyright, attribution, "
            "model/personality rights, hairstyle label and set rights_verified, "
            "personality_rights_verified, style_verified and training_approved to true "
            "before preparation."
        ),
    }
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
