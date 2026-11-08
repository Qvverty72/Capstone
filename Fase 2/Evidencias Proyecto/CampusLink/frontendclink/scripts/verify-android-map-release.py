"""Check the actual R8-optimized DEX API, not just the input ProGuard rules."""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def verify(mapping_path, xml_paths):
    names = dict(re.findall(r"^(\S+) -> (\S+):$", Path(mapping_path).read_text(encoding="utf-8"), re.M))
    required = ["expo.modules.gl.GLView", "expo.modules.gl.GLContext", "expo.modules.kotlin.AppContext"]
    for name in required:
        if name not in names:
            raise ValueError(f"Missing R8 mapping for {name}")

    classes = {}
    for xml_path in xml_paths:
        for package in ET.parse(xml_path).getroot().findall("package"):
            for cls in package.findall("class"):
                full_name = ".".join(filter(None, [package.get("name"), cls.get("name")]))
                if full_name in [names[name] for name in required[:2]]:
                    classes[full_name] = cls

    def concrete_class(original):
        cls = classes.get(names[original])
        if cls is None or cls.get("abstract") != "false" or cls.get("interface") != "false":
            raise ValueError(f"Missing or abstract DEX class: {original}")
        return cls

    view = concrete_class(required[0])
    expected_params = ["android.content.Context", names[required[2]]]
    constructors = [ctor for ctor in view.findall("constructor")
                    if ctor.get("visibility") == "public"
                    and [p.get("type") for p in ctor.findall("parameter")] == expected_params]
    if view.get("extends") != "android.view.TextureView" or not constructors:
        raise ValueError("GLView lost its public (Context, AppContext) constructor")

    context = concrete_class(required[1])
    flush = [method for method in context.findall("method")
             if method.get("name") == "flush" and method.get("return") == "void"
             and method.get("visibility") == "public" and method.get("static") == "false"
             and method.get("abstract") == "false" and not method.findall("parameter")]
    if not flush:
        raise ValueError("GLContext lost public void flush() required by JNI")

    return {"GLView": names[required[0]], "GLContext": names[required[1]],
            "constructor": "public (Context, AppContext)", "flush": "public void flush()"}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("Usage: verify-android-map-release.py R8-mapping.txt dex-api.xml [more-dex-api.xml ...]")
    print(json.dumps(verify(sys.argv[1], sys.argv[2:])))
