#!/usr/bin/env python3

from __future__ import annotations

import re
import shutil
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
MAIN_PPT = DESKTOP / "Isokinetic V5BI 2026.pptx"
BACKUP_PPT = DESKTOP / "Isokinetic V5BI 2026 Backup.pptx"
STILLS_PPT = DESKTOP / "Isokinetic V5BI 2026 Stills Backup.pptx"
OUT_DIR = Path("/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/out")

ELIGIBILITY_VIDEO = OUT_DIR / "GBIEligibilitySlide-updated-tv.mp4"
SURV_VIDEO = OUT_DIR / "ProblemFramingSurveillanceSlide-tv.mp4"
LIT_VIDEO = OUT_DIR / "ProblemFramingLiteratureSlide-tv.mp4"
SURV_START_STILL = OUT_DIR / "ProblemFramingSurveillanceSlide-frame0-4k.png"
SURV_END_STILL = OUT_DIR / "ProblemFramingSurveillanceSlide-last-4k.png"
LIT_START_STILL = OUT_DIR / "ProblemFramingLiteratureSlide-frame0-4k.png"
LIT_END_STILL = OUT_DIR / "ProblemFramingLiteratureSlide-last-4k.png"


def ffprobe_duration_ms(video: Path) -> int:
    import subprocess

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


def read_zip(path: Path) -> dict[str, bytes]:
    with zipfile.ZipFile(path, "r") as zf:
        return {info.filename: zf.read(info.filename) for info in zf.infolist()}


def write_zip(path: Path, files: dict[str, bytes]) -> None:
    temp_dir = Path(tempfile.mkdtemp(prefix="isokinetic_problem_patch_"))
    out_path = temp_dir / path.name
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as out_zip:
        for name, data in sorted(files.items()):
            out_zip.writestr(name, data)

    with zipfile.ZipFile(out_path, "r") as verify_zip:
        broken = verify_zip.testzip()
        if broken is not None:
            raise RuntimeError(f"Patched deck zip structure is invalid at {broken}")

    shutil.copy2(out_path, path)


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


def add_slide_relationships(files: dict[str, bytes], slide_names: list[str]) -> dict[str, str]:
    root = ET.fromstring(files["ppt/_rels/presentation.xml.rels"])
    rel_ids = [
        int(match.group(1))
        for rel in root.findall(f"{{{PKG_REL_NS}}}Relationship")
        if (match := re.match(r"rId(\d+)", rel.get("Id", "")))
    ]
    next_rel_num = max(rel_ids) + 1
    new_slide_rels: dict[str, str] = {}
    for offset, slide_name in enumerate(slide_names):
        rel_id = f"rId{next_rel_num + offset}"
        new_slide_rels[slide_name] = rel_id
        root.append(
            ET.Element(
                f"{{{PKG_REL_NS}}}Relationship",
                {
                    "Id": rel_id,
                    "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
                    "Target": f"slides/{slide_name}",
                },
            )
        )
    files["ppt/_rels/presentation.xml.rels"] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return new_slide_rels


def insert_slide_order(
    files: dict[str, bytes],
    new_slide_rels: dict[str, str],
    insert_before_target: str,
) -> int:
    rels_root = ET.fromstring(files["ppt/_rels/presentation.xml.rels"])
    rel_target_map = {
        rel.get("Id"): rel.get("Target")
        for rel in rels_root.findall(f"{{{PKG_REL_NS}}}Relationship")
        if rel.get("Type") == "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
    }

    presentation_root = ET.fromstring(files["ppt/presentation.xml"])
    sld_id_lst = presentation_root.find(f"{{{P_NS}}}sldIdLst")
    if sld_id_lst is None:
        raise RuntimeError("Missing slide id list")

    max_slide_id = max(int(node.get("id")) for node in sld_id_lst.findall(f"{{{P_NS}}}sldId"))
    ordered = list(sld_id_lst)
    rebuilt: list[ET.Element] = []
    inserted = False
    for node in ordered:
        target = rel_target_map.get(node.get(f"{{{R_NS}}}id"))
        if target == insert_before_target and not inserted:
            for offset, slide_name in enumerate(new_slide_rels):
                rebuilt.append(
                    ET.Element(
                        f"{{{P_NS}}}sldId",
                        {"id": str(max_slide_id + offset + 1), f"{{{R_NS}}}id": new_slide_rels[slide_name]},
                    )
                )
            inserted = True
        rebuilt.append(node)

    if not inserted:
        raise RuntimeError(f"Could not find insertion target {insert_before_target}")

    sld_id_lst[:] = rebuilt
    files["ppt/presentation.xml"] = ET.tostring(presentation_root, encoding="utf-8", xml_declaration=True)
    return len(rebuilt)


def patch_main_ppt() -> None:
    files = read_zip(MAIN_PPT)

    files["ppt/media/media15.mp4"] = ELIGIBILITY_VIDEO.read_bytes()
    files["ppt/slides/slide13.xml"] = set_video_duration_ms(
        files["ppt/slides/slide13.xml"],
        ffprobe_duration_ms(ELIGIBILITY_VIDEO),
        "GBIEligibilitySlide-updated-tv.mp4",
    )

    files["ppt/media/image36.png"] = SURV_START_STILL.read_bytes()
    files["ppt/media/media18.mp4"] = SURV_VIDEO.read_bytes()
    files["ppt/media/image37.png"] = SURV_END_STILL.read_bytes()
    files["ppt/media/image38.png"] = LIT_START_STILL.read_bytes()
    files["ppt/media/media19.mp4"] = LIT_VIDEO.read_bytes()
    files["ppt/media/image39.png"] = LIT_END_STILL.read_bytes()

    files["ppt/slides/slide52.xml"] = set_still_description(files["ppt/slides/slide51.xml"], "ProblemFramingSurveillanceSlide-frame0-4k.png")
    files["ppt/slides/_rels/slide52.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide51.xml.rels"],
        {"rId2": "../media/image36.png"},
    )

    files["ppt/slides/slide53.xml"] = set_video_duration_ms(
        files["ppt/slides/slide44.xml"],
        ffprobe_duration_ms(SURV_VIDEO),
        "ProblemFramingSurveillanceSlide-tv.mp4",
    )
    files["ppt/slides/_rels/slide53.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide44.xml.rels"],
        {
            "rId2": "../media/media18.mp4",
            "rId3": "../media/media18.mp4",
            "rId4": "../media/image36.png",
        },
    )

    files["ppt/slides/slide54.xml"] = set_still_description(files["ppt/slides/slide51.xml"], "ProblemFramingSurveillanceSlide-last-4k.png")
    files["ppt/slides/_rels/slide54.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide51.xml.rels"],
        {"rId2": "../media/image37.png"},
    )

    files["ppt/slides/slide55.xml"] = set_still_description(files["ppt/slides/slide51.xml"], "ProblemFramingLiteratureSlide-frame0-4k.png")
    files["ppt/slides/_rels/slide55.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide51.xml.rels"],
        {"rId2": "../media/image38.png"},
    )

    files["ppt/slides/slide56.xml"] = set_video_duration_ms(
        files["ppt/slides/slide44.xml"],
        ffprobe_duration_ms(LIT_VIDEO),
        "ProblemFramingLiteratureSlide-tv.mp4",
    )
    files["ppt/slides/_rels/slide56.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide44.xml.rels"],
        {
            "rId2": "../media/media19.mp4",
            "rId3": "../media/media19.mp4",
            "rId4": "../media/image38.png",
        },
    )

    files["ppt/slides/slide57.xml"] = set_still_description(files["ppt/slides/slide51.xml"], "ProblemFramingLiteratureSlide-last-4k.png")
    files["ppt/slides/_rels/slide57.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide51.xml.rels"],
        {"rId2": "../media/image39.png"},
    )

    for slide_num in range(52, 58):
        files["[Content_Types].xml"] = add_content_type_override(files["[Content_Types].xml"], slide_num)

    new_slide_rels = add_slide_relationships(
        files,
        ["slide52.xml", "slide53.xml", "slide54.xml", "slide55.xml", "slide56.xml", "slide57.xml"],
    )
    slide_count = insert_slide_order(files, new_slide_rels, "slides/slide43.xml")
    files["docProps/app.xml"] = update_app_xml(files["docProps/app.xml"], slide_count)

    write_zip(MAIN_PPT, files)


def patch_stills_ppt() -> None:
    files = read_zip(STILLS_PPT)

    files["ppt/media/image20.png"] = SURV_START_STILL.read_bytes()
    files["ppt/media/image21.png"] = SURV_END_STILL.read_bytes()
    files["ppt/media/image22.png"] = LIT_START_STILL.read_bytes()
    files["ppt/media/image23.png"] = LIT_END_STILL.read_bytes()

    files["ppt/slides/slide21.xml"] = set_still_description(files["ppt/slides/slide20.xml"], "ProblemFramingSurveillanceSlide-frame0-4k.png")
    files["ppt/slides/_rels/slide21.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide20.xml.rels"],
        {"rId2": "../media/image20.png"},
    )

    files["ppt/slides/slide22.xml"] = set_still_description(files["ppt/slides/slide20.xml"], "ProblemFramingSurveillanceSlide-last-4k.png")
    files["ppt/slides/_rels/slide22.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide20.xml.rels"],
        {"rId2": "../media/image21.png"},
    )

    files["ppt/slides/slide23.xml"] = set_still_description(files["ppt/slides/slide20.xml"], "ProblemFramingLiteratureSlide-frame0-4k.png")
    files["ppt/slides/_rels/slide23.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide20.xml.rels"],
        {"rId2": "../media/image22.png"},
    )

    files["ppt/slides/slide24.xml"] = set_still_description(files["ppt/slides/slide20.xml"], "ProblemFramingLiteratureSlide-last-4k.png")
    files["ppt/slides/_rels/slide24.xml.rels"] = swap_rel_targets(
        files["ppt/slides/_rels/slide20.xml.rels"],
        {"rId2": "../media/image23.png"},
    )

    for slide_num in range(21, 25):
        files["[Content_Types].xml"] = add_content_type_override(files["[Content_Types].xml"], slide_num)

    new_slide_rels = add_slide_relationships(
        files,
        ["slide21.xml", "slide22.xml", "slide23.xml", "slide24.xml"],
    )
    slide_count = insert_slide_order(files, new_slide_rels, "slides/slide17.xml")
    files["docProps/app.xml"] = update_app_xml(files["docProps/app.xml"], slide_count)

    write_zip(STILLS_PPT, files)


def main() -> None:
    required = [
        MAIN_PPT,
        STILLS_PPT,
        ELIGIBILITY_VIDEO,
        SURV_VIDEO,
        LIT_VIDEO,
        SURV_START_STILL,
        SURV_END_STILL,
        LIT_START_STILL,
        LIT_END_STILL,
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing required input(s): {missing}")

    patch_main_ppt()
    shutil.copy2(MAIN_PPT, BACKUP_PPT)
    patch_stills_ppt()


if __name__ == "__main__":
    main()
