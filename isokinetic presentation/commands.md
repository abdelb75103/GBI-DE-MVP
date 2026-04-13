# Command Templates

## 1. Build Research Layer

```bash
python3 /Users/abdelbabiker/Documents/Gotenks/web-research-packet/scripts/run_research_packet.py \
  --research-mode deep \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/context.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/scope-notes.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/project-notes.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/data-note.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/provisional-data-signals.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/sources.md" \
  --output-dir "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/research" \
  "Build a primary-source research packet for an academic conference talk on the FIFA GBI Living Systematic Review. Focus on the football injury surveillance consensus statements, the football-specific extension, and the 2026 global surveillance-map paper. Emphasize best-practice reporting, comparability, and the most useful framing for a professional conference talk."
```

## 2. First Gotenks Run: Planning Brief

```bash
python3 /Users/abdelbabiker/Documents/Gotenks/gotenks/scripts/run_gotenks.py \
  --command-timeout 600 \
  --prompt-file "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/planning-prompt.md" \
  --research-file "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/research/research-packet.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/context.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/scope-notes.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/project-notes.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/data-note.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/provisional-data-signals.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/sources.md" \
  --output-dir "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/planning-brief"
```

## 3. Second Gotenks Run: Execution Brief

```bash
python3 /Users/abdelbabiker/Documents/Gotenks/gotenks/scripts/run_gotenks.py \
  --command-timeout 600 \
  --prompt-file "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/execution-prompt.md" \
  --research-file "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/research/research-packet.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/planning-brief/planning-brief.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/context.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/scope-notes.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/project-notes.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/data-note.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/provisional-data-signals.md" \
  --source "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/sources.md" \
  --output-dir "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/execution-brief"
```
