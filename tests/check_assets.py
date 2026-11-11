from pathlib import Path
import re, subprocess, json
root=Path(__file__).resolve().parents[1]
js=(root/'catalog.js').read_text(encoding='utf8')
tracks=re.findall(r'"file":"(assets/audio/[^"]+\.mp3)"',js)
assert len(tracks)==18, f"Expected 18 tracks, got {len(tracks)}"
for path in tracks:
    f=root/path
    assert f.is_file() and f.stat().st_size>1000, f"Missing audio: {path}"
    out=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(f)],capture_output=True,text=True)
    if out.returncode==0:
        assert float(json.loads(out.stdout)['format']['duration'])>0
html=(root/'index.html').read_text(encoding='utf8')
for fid in ('searchInput','soundGrid','audioElement','authForm','cloudUploadForm','microModal','accountModal','detailWave','progressRange'):
    assert f'id="{fid}"' in html, f"Missing element #{fid}"
print('OK: 18 SFX files and required UI elements')
