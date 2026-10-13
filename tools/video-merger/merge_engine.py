"""Local video processing; originals are never modified."""
from __future__ import annotations
import hashlib, json, math, os, re, shutil, subprocess, tempfile, threading, urllib.request, uuid, zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

VIDEO_EXTENSIONS = {'.mp4', '.mov', '.mkv', '.avi', '.wmv', '.m4v', '.webm', '.mts', '.m2ts', '.mpg', '.mpeg', '.3gp'}
DOWNLOAD = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'

class Cancelled(Exception): pass

@dataclass(frozen=True)
class Clip:
    path: Path
    duration: float
    audio: bool
    recorded_date: str = ""
    size: int = 0


def check_cancel(cancel):
    if cancel.is_set(): raise Cancelled('Cancelled. Originals and completed outputs are unchanged.')


def tools(progress=lambda message: None, cancel=None):
    cancel = cancel or threading.Event()
    ffmpeg, ffprobe = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if ffmpeg and ffprobe: return ffmpeg, ffprobe
    if os.name != 'nt': raise RuntimeError('Install ffmpeg and ffprobe before using this app.')
    root = Path(os.environ['LOCALAPPDATA']) / 'VideoBatchMerger' / 'ffmpeg'
    root.mkdir(parents=True, exist_ok=True)
    if (root/'ffmpeg.exe').exists() and (root/'ffprobe.exe').exists():
        return str(root/'ffmpeg.exe'), str(root/'ffprobe.exe')
    progress('First-time setup: downloading FFmpeg from gyan.dev (about 110 MB)…')
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        archive = Path(temporary)/'ffmpeg.zip'
        with urllib.request.urlopen(DOWNLOAD+'.sha256', timeout=30) as response:
            matches = re.findall(r'\b[a-fA-F0-9]{64}\b', response.read(4096).decode())
        if not matches: raise RuntimeError('Could not verify the FFmpeg download checksum.')
        expected = matches[0].lower()
        digest = hashlib.sha256()
        with urllib.request.urlopen(DOWNLOAD, timeout=60) as response, archive.open('wb') as target:
            while True:
                check_cancel(cancel)
                block = response.read(1024*1024)
                if not block: break
                digest.update(block); target.write(block)
        if digest.hexdigest() != expected: raise RuntimeError('FFmpeg checksum mismatch. Try again; no files were processed.')
        with zipfile.ZipFile(archive) as bundle:
            for name in ('ffmpeg.exe', 'ffprobe.exe'):
                entries = [entry for entry in bundle.infolist() if entry.filename.endswith('/bin/'+name)]
                if len(entries) != 1: raise RuntimeError('Unexpected FFmpeg download contents.')
                stage = Path(temporary)/name
                with bundle.open(entries[0]) as source, stage.open('wb') as target: shutil.copyfileobj(source, target)
                os.replace(stage, root/name)
    return str(root/'ffmpeg.exe'), str(root/'ffprobe.exe')


def run(command, cancel, timeout=None):
    check_cancel(cancel)
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    with tempfile.TemporaryFile() as error:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=error, creationflags=flags)
        import time
        start = time.monotonic()
        while True:
            try:
                output, _ = process.communicate(timeout=0.2)
                break
            except subprocess.TimeoutExpired:
                if cancel.is_set() or (timeout and time.monotonic()-start > timeout):
                    process.terminate()
                    try: process.wait(timeout=3)
                    except subprocess.TimeoutExpired: process.kill(); process.wait()
                    check_cancel(cancel)
                    raise RuntimeError('Video inspection timed out.')
        if process.returncode:
            error.seek(0, 2); end = error.tell(); error.seek(max(0, end-5000))
            raise RuntimeError(error.read().decode(errors='replace').strip() or 'Video processing failed.')
        return output


def inspect(path, ffprobe, cancel):
    path = Path(path).resolve(strict=True)
    if path.suffix.lower() not in VIDEO_EXTENSIONS or path.name.lower().endswith('.d.mts'):
        raise ValueError('Not a supported video file.')
    data = json.loads(run([ffprobe, '-v','error','-show_format','-show_streams','-of','json',str(path)], cancel, 30))
    streams = data.get('streams', [])
    video = [stream for stream in streams if stream.get('codec_type') == 'video' and not stream.get('disposition', {}).get('attached_pic')]
    if not video: raise ValueError('No video stream found.')
    duration = float(data.get('format', {}).get('duration') or video[0].get('duration') or 0)
    if not math.isfinite(duration) or duration <= 0: raise ValueError('Cannot determine video length.')
    if duration > 300: raise ValueError(f'Longer than five minutes ({duration/60:.1f} minutes).')
    stamp = data.get('format', {}).get('tags', {}).get('creation_time')
    if not stamp:
        stamp = video[0].get('tags', {}).get('creation_time')
    try: recorded = datetime.fromisoformat(str(stamp).replace('Z', '+00:00')).date().isoformat()
    except (ValueError, TypeError): recorded = datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
    return Clip(path, duration, any(stream.get('codec_type') == 'audio' for stream in streams), recorded, path.stat().st_size)


def batches(clips, size):
    if size not in (10, 20): raise ValueError('Choose batches of 10 or 20.')
    return [clips[offset:offset+size] for offset in range(0, len(clips), size)]


def merge(clips, output, ffmpeg, ffprobe, cancel, progress=lambda message:None, dimensions=(1920,1080)):
    if not clips: raise ValueError('No eligible videos selected.')
    output = Path(output)
    if output.exists(): raise FileExistsError('Output already exists. Choose another output name.')
    output.parent.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(output.parent).free < 512*1024**2: raise RuntimeError('Less than 512 MB free on the output drive. Choose another drive.')
    width,height = dimensions
    if width <= 0 or height <= 0 or width%2 or height%2: raise ValueError('Output dimensions must be positive even numbers.')
    partial = output.with_name(output.stem+'.'+uuid.uuid4().hex+'.part.mp4')
    try:
        with tempfile.TemporaryDirectory(prefix='video-merger-',dir=output.parent) as folder:
            folder=Path(folder)
            for index,clip in enumerate(clips):
                check_cancel(cancel); progress(f'Preparing clip {index+1}/{len(clips)}: {clip.path.name}')
                command=[ffmpeg,'-hide_banner','-loglevel','error','-nostdin','-n','-i',str(clip.path)]
                if not clip.audio: command += ['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']
                command += ['-map','0:v:0','-map','0:a:0' if clip.audio else '1:a:0',
                    '-vf',f'setpts=PTS-STARTPTS,scale={width}:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30',
                    '-af','asetpts=PTS-STARTPTS,aresample=48000,apad', '-t',str(clip.duration),
                    '-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p',
                    '-c:a','aac','-b:a','128k','-ar','48000','-ac','2',
                    '-video_track_timescale','30000',str(folder/f'clip-{index:04}.mp4')]
                run(command,cancel)
            listing=folder/'clips.txt'
            listing.write_text(''.join(f"file 'clip-{i:04}.mp4'\n" for i in range(len(clips))),encoding='utf-8')
            progress('Joining clips and checking the output…')
            run([ffmpeg,'-hide_banner','-loglevel','error','-nostdin','-n','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(partial)],cancel)
            data=json.loads(run([ffprobe,'-v','error','-show_format','-show_streams','-of','json',str(partial)],cancel,30))
            actual=float(data['format']['duration']); expected=sum(clip.duration for clip in clips)
            if abs(actual-expected)>max(1,len(clips)*.1): raise RuntimeError('Output length check failed. Originals are unchanged.')
            if not any(s.get('codec_type')=='video' for s in data['streams']): raise RuntimeError('Output video check failed.')
            check_cancel(cancel)
            # Publish without overwriting and without duplicating disk space.
            if os.name == 'nt': os.rename(partial, output)
            else: os.link(partial, output)
            return output
    except BaseException:
        # Remove only an output that this invocation created, never an existing file.
        raise
    finally:
        partial.unlink(missing_ok=True)


def grouped_batches(clips, size, group_by='None', sort_by='Manual'):
    from collections import OrderedDict
    if size not in (10, 20): raise ValueError('Choose batches of 10 or 20.')
    if group_by not in ('None','Date','Name prefix','Size range'): raise ValueError('Invalid grouping.')
    if sort_by not in ('Manual','Date','Name','Size'): raise ValueError('Invalid sorting.')
    selected=list(clips)
    if sort_by=='Date': selected.sort(key=lambda c:(c.recorded_date,c.path.name.lower()))
    elif sort_by=='Name': selected.sort(key=lambda c:c.path.name.lower())
    elif sort_by=='Size': selected.sort(key=lambda c:c.size)
    groups=OrderedDict()
    for clip in selected:
        if group_by=='Date': key=clip.recorded_date
        elif group_by=='Name prefix': key=re.sub(r'(?:[_ -]?\d+)+$', '', clip.path.stem).strip('_ -').lower() or 'Numbered videos'
        elif group_by=='Size range': key='Small-under-100MB' if clip.size<100*1024**2 else 'Medium-100-to-500MB' if clip.size<500*1024**2 else 'Large-500MB-and-up'
        else: key='Videos'
        groups.setdefault(key,[]).append(clip)
    return [(key,batch) for key,group in groups.items() for batch in batches(group,size)]
