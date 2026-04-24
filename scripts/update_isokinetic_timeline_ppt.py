#!/usr/bin/env python3

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"

ET.register_namespace("a", "http://schemas.openxmlformats.org/drawingml/2006/main")
ET.register_namespace("p", P_NS)
ET.register_namespace("p14", "http://schemas.microsoft.com/office/powerpoint/2010/main")
ET.register_namespace("r", R_NS)

DESKTOP = Path("/Users/abdelbabiker/Desktop")
PPT_PATH = DESKTOP / "Isokinetic V5BI 2026.pptx"
PATCH_BACKUP_PATH = DESKTOP / "Isokinetic V5BI 2026.before-overall-remotion-split.pptx"
PRESENTATION_DIR = Path("/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation")
REMOTION_OUT_DIR = PRESENTATION_DIR / "out"

OVERALL_VIDEO = REMOTION_OUT_DIR / "PapersTimelineOverallSlide.mp4"
EXCLUDED_VIDEO = REMOTION_OUT_DIR / "PapersTimelineExcludedOverlaySlide.mp4"
OVERALL_FINAL_STILL = REMOTION_OUT_DIR / "PapersTimelineOverallSlide-last.png"
EXCLUDED_FINAL_STILL = REMOTION_OUT_DIR / "PapersTimelineExcludedOverlaySlide-last.png"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ffprobe_duration_ms(video: Path) -> int:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return round(float(result.stdout.strip()) * 1000)


def extract_last_frame(video: Path, out_path: Path) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-sseof",
            "-0.05",
            "-i",
            str(video),
            "-frames:v",
            "1",
            str(out_path),
        ]
    )


def set_video_duration_ms(slide_xml: bytes, duration_ms: int, shape_name: str) -> bytes:
    root = ET.fromstring(slide_xml)
    transition = root.find(f"{{{P_NS}}}transition")
    if transition is not None:
        transition.set("advTm", str(duration_ms))
        transition.set("advClick", "0")
    c_nv_pr = root.find(f".//{{{P_NS}}}cNvPr[@id='2']")
    if c_nv_pr is not None:
        c_nv_pr.set("name", shape_name)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def set_still_description(slide_xml: bytes, description: str) -> bytes:
    root = ET.fromstring(slide_xml)
    c_nv_pr = root.find(f".//{{{P_NS}}}cNvPr[@id='2']")
    if c_nv_pr is not None:
        c_nv_pr.set("descr", description)
        c_nv_pr.set("name", "Picture 1")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def swap_rel_targets(rels_xml: bytes, replacements: dict[str, str]) -> bytes:
    root = ET.fromstring(rels_xml)
    for rel in root.findall(f"{{{PKG_REL_NS}}}Relationship"):
        rel_id = rel.get("Id")
        if rel_id in replacements:
            rel.set("Target", replacements[rel_id])
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def add_content_type_override(content_types_xml: bytes, slide_num: int) -> bytes:
    root = ET.fromstring(content_types_xml)
    part_name = f"/ppt/slides/slide{slide_num}.xml"
    for override in root.findall(f"{{{CT_NS}}}Override"):
        if override.get("PartName") == part_name:
            return ET.tostring(root, encoding="utf-8", xml_declaration=True)
    root.append(
        ET.Element(
            f"{{{CT_NS}}}Override",
            {
                "PartName": part_name,
                "ContentType": "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
            },
        )
    )
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def update_app_xml(app_xml: bytes, slide_count: int) -> bytes:
    ns = {
        "ap": "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
        "vt": "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes",
    }
    root = ET.fromstring(app_xml)
    slides = root.find("ap:Slides", ns)
    if slides is not None:
        slides.text = str(slide_count)
    vector = root.find(".//vt:vector", ns)
    heading_values = root.findall(".//vt:i4", ns)
    if vector is not None:
        vector.set("size", str(slide_count))
    if len(heading_values) >= 2:
        heading_values[1].text = str(slide_count)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def main() -> None:
    required = [PPT_PATH, OVERALL_VIDEO, EXCLUDED_VIDEO, OVERALL_FINAL_STILL]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing required input(s): {missing}")

    if not EXCLUDED_FINAL_STILL.exists():
        extract_last_frame(EXCLUDED_VIDEO, EXCLUDED_FINAL_STILL)

    if not PATCH_BACKUP_PATH.exists():
        shutil.copy2(PPT_PATH, PATCH_BACKUP_PATH)

    overall_ms = ffprobe_duration_ms(OVERALL_VIDEO)
    excluded_ms = ffprobe_duration_ms(EXCLUDED_VIDEO)

    with zipfile.ZipFile(PPT_PATH, "r") as zf:
        files = {info.filename: zf.read(info.filename) for info in zf.infolist()}

    files["ppt/media/media9.mp4"] = OVERALL_VIDEO.read_bytes()
    files["ppt/media/image20.png"] = OVERALL_FINAL_STILL.read_bytes()
    files["ppt/media/media16.mp4"] = EXCLUDED_VIDEO.read_bytes()
    files["ppt/media/image33.png"] = EXCLUDED_FINAL_STILL.read_bytes()

    files["ppt/slides/slide29.xml"] = set_video_duration_ms(
        files["ppt/slides/slide29.xml"],
        overall_ms,
        "PapersTimelineOverallSlide.mp4",
    )
    files["ppt/slides/slide30.xml"] = set_still_description(
        files["ppt/slides/slide30.xml"],
        "PapersTimelineOverallSlide-last.png",
    )

    files["ppt/slides/slide47.xml"] = set_video_duration_ms(
        files["ppt/slides/slide29.xml"],
        excluded_ms,
        "PapersTimelineExcludedOverlaySlide.mp4",
    )
    files["ppt/slides/_rels/slide47.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide29.xml.rels"],
        {
            "rId2": "../media/media16.mp4",
            "rId3": "../media/media16.mp4",
            "rId4": "../media/image20.png",
        },
    )
    files["ppt/slides/slide48.xml"] = set_still_description(
        files["ppt/slides/slide30.xml"],
        "PapersTimelineExcludedOverlaySlide-last.png",
    )
    files["ppt/slides/_rels/slide48.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide30.xml.rels"],
        {"rId2": "../media/image33.png"},
    )

    files["[Content_Types].xml"] = add_content_type_override(files["[Content_Types].xml"], 47)
    files["[Content_Types].xml"] = add_content_type_override(files["[Content_Types].xml"], 48)

    presentation_rels_root = ET.fromstring(files["ppt/_rels/presentation.xml.rels"])
    rel_ids = [
        int(match.group(1))
        for rel in presentation_rels_root.findall(f"{{{PKG_REL_NS}}}Relationship")
        if (match := re.match(r"rId(\d+)", rel.get("Id", "")))
    ]
    next_rel_num = max(rel_ids) + 1
    new_slide_rels = {
        "slide47.xml": f"rId{next_rel_num}",
        "slide48.xml": f"rId{next_rel_num + 1}",
    }
    for slide_name, rel_id in new_slide_rels.items():
        presentation_rels_root.append(
            ET.Element(
                f"{{{PKG_REL_NS}}}Relationship",
                {
                    "Id": rel_id,
                    "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
                    "Target": f"slides/{slide_name}",
                },
            )
        )
    files["ppt/_rels/presentation.xml.rels"] = ET.tostring(
        presentation_rels_root,
        encoding="utf-8",
        xml_declaration=True,
    )

    presentation_root = ET.fromstring(files["ppt/presentation.xml"])
    sld_id_lst = presentation_root.find(f"{{{P_NS}}}sldIdLst")
    if sld_id_lst is None:
        raise RuntimeError("Missing slide id list")

    max_slide_id = max(int(node.get("id")) for node in sld_id_lst.findall(f"{{{P_NS}}}sldId"))
    slide_ids = {
        "slide47.xml": str(max_slide_id + 1),
        "slide48.xml": str(max_slide_id + 2),
    }
    rel_target_map = {
        rel.get("Id"): rel.get("Target")
        for rel in presentation_rels_root.findall(f"{{{PKG_REL_NS}}}Relationship")
        if rel.get("Type") == "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
    }

    ordered = list(sld_id_lst)
    rebuilt: list[ET.Element] = []
    for node in ordered:
        rebuilt.append(node)
        target = rel_target_map.get(node.get(f"{{{R_NS}}}id"))
        if target == "slides/slide30.xml":
            rebuilt.append(
                ET.Element(
                    f"{{{P_NS}}}sldId",
                    {"id": slide_ids["slide47.xml"], f"{{{R_NS}}}id": new_slide_rels["slide47.xml"]},
                )
            )
            rebuilt.append(
                ET.Element(
                    f"{{{P_NS}}}sldId",
                    {"id": slide_ids["slide48.xml"], f"{{{R_NS}}}id": new_slide_rels["slide48.xml"]},
                )
            )

    sld_id_lst[:] = rebuilt
    files["ppt/presentation.xml"] = ET.tostring(presentation_root, encoding="utf-8", xml_declaration=True)
    files["docProps/app.xml"] = update_app_xml(files["docProps/app.xml"], slide_count=len(rebuilt))

    temp_dir = Path(tempfile.mkdtemp(prefix="isokinetic_overall_timeline_split_"))
    out_path = temp_dir / PPT_PATH.name
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as out_zip:
        for name, data in sorted(files.items()):
            out_zip.writestr(name, data)

    with zipfile.ZipFile(out_path, "r") as verify_zip:
        if verify_zip.testzip() is not None:
            raise RuntimeError("Patched deck zip structure is invalid")
        expected = {
            "ppt/slides/slide47.xml",
            "ppt/slides/slide48.xml",
            "ppt/media/media16.mp4",
            "ppt/media/image33.png",
        }
        missing_parts = expected.difference(verify_zip.namelist())
        if missing_parts:
            raise RuntimeError(f"Patched deck is missing expected parts: {sorted(missing_parts)}")

    shutil.copy2(out_path, PPT_PATH)


if __name__ == "__main__":
    main()
