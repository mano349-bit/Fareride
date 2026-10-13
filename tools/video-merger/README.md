# Video Batch Merger + YouTube

A Windows desktop app that groups and merges short personal videos, with optional uploads to your YouTube channel. Originals are never deleted or moved.

## Install the Windows app

Open this repository's **Releases** page and download **VideoBatchMerger-Setup.exe**. Run it to install the app for your Windows account and create Start menu/desktop shortcuts. No Python installation, command prompt or BAT launcher is required. **VideoBatchMerger.exe** is also available as a portable app. Both launch a graphical window without a console window.

The executable is built on GitHub's Windows runner with PyInstaller's `--windowed` setting. The workflow validates its PE GUI subsystem and builds the installer with Inno Setup. Executables are unsigned; no signing certificate is included. Inspect the source and checksums if desired.

### Build and release from a new repository

Upload this project's files including `.github/workflows/windows-build.yml` to your new repository's `main` branch. Enable GitHub Actions if prompted. A Windows build starts on each push to main; it tests the app and publishes the portable EXE, Setup EXE and checksums as a versioned release. If a repository policy blocks release creation, the build files remain downloadable from the workflow's artifact. No Google credentials are needed for building; do not commit OAuth client JSON or tokens.

## Run from source (developers)

1. Extract this entire ZIP into a folder.
2. If Python is not installed, open PowerShell and run:
   `winget install --id Python.Python.3.13 -e`
   Alternatively install Python from https://www.python.org/downloads/windows/ with the Python launcher and Tcl/Tk components enabled.
3. Double-click **Start-App.bat**. The first launch installs Google's Python API libraries in `%LOCALAPPDATA%\VideoBatchMerger\venv`. Internet access is needed for setup.
4. Add videos or a folder. **Add folder scans that folder only**, not subfolders. Select one queued item and use Move up/down for manual order.
5. Choose batches of **10 or 20**, a grouping option, and an ordering option. Choose an output folder with plenty of free space, then click **Merge videos**.

The first merge downloads FFmpeg if it is not installed. The download is approximately 110 MB, and its SHA-256 checksum is checked against the publisher's checksum. FFmpeg tools are stored under `%LOCALAPPDATA%\VideoBatchMerger\ffmpeg`.

## Grouping and ordering

- **None:** merge the whole queue, split into batches of 10 or 20.
- **Date:** separate batches for each recorded day. If recording metadata is missing, use the file's last-modified day. Recording metadata is not always accurate.
- **Name prefix:** group common prefixes before trailing numbers. For example, `IMG_001.mp4` and `IMG_002.mp4` group together as `img`. Unnumbered names use their full stem.
- **Size range:** small under 100 MiB; medium 100–500 MiB; large 500 MiB and above. Size thresholds are binary MiB, despite the shortened MB labels in output filenames.
- **Sort by:** Manual queue order, Date oldest first, Name A–Z, or Size smallest first, within grouping.

Every group is divided into batches. A smaller final batch is included: 23 clips in 10-clip mode produces 10 + 10 + 3. Videos longer than 300 seconds, unreadable videos and unsupported files are skipped and logged.

Outputs are MP4/H.264 with AAC audio, 30 fps and a chosen landscape 1080p, landscape 720p, or portrait 1080p frame. Clips are fitted with padding so they are not cropped; silent clips receive silent audio. Output files and CSV reports have unique names. A report records each source and output. Cancellation removes unfinished output and temporary clips while leaving completed batches and all original files in place.

## YouTube setup (one time)

The app cannot upload until you connect your own Google developer project and channel. Do not send your account password or OAuth client JSON to anyone.

1. Open https://console.cloud.google.com/ and select or create a project.
2. Open **APIs & Services → Library**; enable **YouTube Data API v3**.
3. Open **Google Auth Platform** (or OAuth consent screen). Configure the app name/contact details and choose **External** audience for a personal Gmail account.
4. While the app is in Testing, add the Gmail address that owns your channel under **Audience → Test users**.
5. Under **Data Access**, add the scope `https://www.googleapis.com/auth/youtube.upload`.
6. Under **Clients**, create an OAuth client of type **Desktop app** and download its JSON. Do not choose Web application or service account.
7. In Video Batch Merger, browse to that JSON and click **Sign in to YouTube**. Complete Google's consent flow in your browser, using the account/channel you intend to upload to. A local loopback callback is used; the app does not ask for your password.
8. Choose a title prefix, visibility and the correct **Made for kids** declaration. Click **Upload videos…**, select the finished MP4s, and review the upload confirmation.

Uploads default to **Private**. Merging does not trigger uploads. You may also choose Unlisted or Public, but Google restricts uploads from newer unaudited API projects to Private until the project passes its audit. Private uploads still need a working OAuth consent/client configuration. OAuth verification, API upload audits, quota, and YouTube channel verification are separate requirements. Each API upload consumes quota.

Your channel must be verified to upload videos longer than 15 minutes. A 20-clip batch can be up to 100 minutes. Check channel eligibility before uploading. Uploads may take additional time to process on YouTube after the file transfer finishes.

Tokens are held in memory only; sign in again after restarting. Files are uploaded in resumable 8 MiB chunks, with retries for transient errors. An upload can resume during that running session, but **restart/resume across app restarts is not provided**. If upload fails, check YouTube Studio before retrying to avoid uploading a completed video twice. Cancellation waits for an in-flight chunk/API request to return; a video already accepted by YouTube is not deleted. A CSV with completed upload links is saved beside the first selected upload file.

## Disk space and privacy

All merging is local. Videos are sent to Google only after you explicitly choose Upload and confirm the selected files/visibility. Originals and completed merged files are kept after uploads.

Merging alone does not guarantee space savings. This app re-encodes video, so quality and file size can change. Output files and temporary encoded clips require additional disk space during processing. The 512 MiB minimum check is only a basic safeguard, not an estimate of the space needed. Choose an external drive with sufficient room for large batches. Inspect finished videos and confirm any uploads before deciding separately whether to remove originals.

## Validation and limitations

Tested in Linux with real FFmpeg-generated fixtures: ten mixed-size clips with/without audio; output duration, dimensions, audio and clip order; preservation of original hashes; cancellation; failure cleanup; existing-file protection; five-minute limit; grouping and 10/20 batching. Upload tests use mocked Google services: no real videos or credentials were uploaded. Python source syntax was checked. A real Windows launch and a real Google-authorized upload still need verification on your computer.

The code is included for inspection: `app.py`, `merge_engine.py`, `youtube_upload.py`. The source ZIP itself is not a Windows EXE. The Windows workflow produces the EXE and installer; their successful build and release must be verified separately. Python is required only when running from source. First-time FFmpeg/Google setup is still required where applicable.

Sources:
- Windows FFmpeg builds: https://www.gyan.dev/ffmpeg/builds/
- YouTube uploads: https://developers.google.com/youtube/v3/docs/videos/insert
- Resumable upload protocol: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- Google Desktop OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
