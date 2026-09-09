"""Build the standalone checklist from the retained literal HTML source."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
# A direct document allows ordinary page scrolling and browser-local progress.
# The explanatory fragment remains a separate, editable source.
stylesheet = (root / 'checklist-app.css').read_text()
fragment = (root / 'checklist-source.html').read_text()
prefix = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FIFA GBI Bayesian V2 Checklist</title><style>'''
layout = ''
output = root.parent / 'BAYESIAN_ANALYSIS_CHECKLIST.html'
output.write_text(prefix + stylesheet + layout + '</style></head><body>\n' + fragment + '\n</body></html>\n')
print(output)
