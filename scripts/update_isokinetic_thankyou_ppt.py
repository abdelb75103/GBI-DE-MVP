#!/usr/bin/env python3

from __future__ import annotations

import shutil
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

ET.register_namespace("a", "http://schemas.openxmlformats.org/drawingml/2006/main")
ET.register_namespace("p", P_NS)
ET.register_namespace("r", R_NS)

DESKTOP = Path("/Users/abdelbabiker/Desktop")
MAIN_PPT = DESKTOP / "Isokinetic V5BI 2026.pptx"
BACKUP_PPT = DESKTOP / "Isokinetic V5BI 2026 Backup.pptx"
STILLS_PPT = DESKTOP / "Isokinetic V5BI 2026 Stills Backup.pptx"
THANK_YOU_STILL = (
    Path("/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/out")
    / "ThankYouSlide-4k-v2.png"
)


def read_zip(path: Path) -> dict[str, bytes]:
    with zipfile.ZipFile(path, "r") as zf:
        return {info.filename: zf.read(info.filename) for info in zf.infolist()}


def write_zip(path: Path, files: dict[str, bytes]) -> None:
    temp_dir = Path(tempfile.mkdtemp(prefix="isokinetic_thankyou_patch_"))
    out_path = temp_dir / path.name
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as out_zip:
        for name, data in sorted(files.items()):
            out_zip.writestr(name, data)
    with zipfile.ZipFile(out_path, "r") as verify_zip:
        broken = verify_zip.testzip()
        if broken is not None:
            raise RuntimeError(f"Zip validation failed for {path.name}: {broken}")
    shutil.copy2(out_path, path)


def set_still_description(slide_xml: bytes, description: str) -> bytes:
    root = ET.fromstring(slide_xml)
    c_nv_pr = root.find(f".//{{{P_NS}}}cNvPr[@id='2']")
    if c_nv_pr is not None:
        c_nv_pr.set("descr", description)
        c_nv_pr.set("name", "Picture 1")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def reorder_slide_targets(files: dict[str, bytes], thank_you_target: str, appendix_target: str) -> None:
    rels_root = ET.fromstring(files["ppt/_rels/presentation.xml.rels"])
    rel_target_map = {
        rel.get("Id"): rel.get("Target")
        for rel in rels_root.findall(f"{{{PKG_REL_NS}}}Relationship")
        if rel.get("Type") == "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
    }

    pres_root = ET.fromstring(files["ppt/presentation.xml"])
    sld_id_lst = pres_root.find(f"{{{P_NS}}}sldIdLst")
    if sld_id_lst is None:
        raise RuntimeError("Missing slide id list")

    ordered = list(sld_id_lst)
    thank_you_node = None
    appendix_index = None

    for index, node in enumerate(ordered):
        target = rel_target_map.get(node.get(f"{{{R_NS}}}id"))
        if target == thank_you_target:
            thank_you_node = node
        if target == appendix_target:
            appendix_index = index

    if thank_you_node is None or appendix_index is None:
        raise RuntimeError("Could not find thank-you or appendix slide reference")

    ordered = [node for node in ordered if node is not thank_you_node]
    ordered.insert(appendix_index, thank_you_node)
    sld_id_lst[:] = ordered
    files["ppt/presentation.xml"] = ET.tostring(pres_root, encoding="utf-8", xml_declaration=True)


def patch_main_deck() -> None:
    files = read_zip(MAIN_PPT)
    files["ppt/media/image35.png"] = THANK_YOU_STILL.read_bytes()
    files["ppt/slides/slide51.xml"] = set_still_description(files["ppt/slides/slide51.xml"], "ThankYouSlide-4k.png")
    reorder_slide_targets(files, "slides/slide51.xml", "slides/slide46.xml")
    write_zip(MAIN_PPT, files)


def patch_stills_deck() -> None:
    files = read_zip(STILLS_PPT)
    files["ppt/media/image19.png"] = THANK_YOU_STILL.read_bytes()
    files["ppt/slides/slide20.xml"] = set_still_description(files["ppt/slides/slide20.xml"], "ThankYouSlide-4k.png")
    reorder_slide_targets(files, "slides/slide20.xml", "slides/slide19.xml")
    write_zip(STILLS_PPT, files)


def main() -> None:
    required = [MAIN_PPT, STILLS_PPT, THANK_YOU_STILL]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing required input(s): {missing}")

    patch_main_deck()
    shutil.copy2(MAIN_PPT, BACKUP_PPT)
    patch_stills_deck()


if __name__ == "__main__":
    main()
