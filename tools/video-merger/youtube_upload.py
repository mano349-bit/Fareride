"""YouTube OAuth and resumable upload. Tokens are kept only in memory."""
import json, time
from pathlib import Path
from merge_engine import check_cancel

SCOPES = ['https://www.googleapis.com/auth/youtube.upload']

def sign_in(client_file, progress=lambda message:None):
    from google_auth_oauthlib.flow import InstalledAppFlow
    data=json.loads(Path(client_file).read_text(encoding='utf-8-sig'))
    if 'installed' not in data: raise ValueError('Choose the OAuth client JSON for a Desktop app, not a service account or Web app.')
    progress('Sign in to Google in your browser and choose the channel to upload to…')
    flow=InstalledAppFlow.from_client_secrets_file(str(client_file),SCOPES)
    flow.run_local_server(host='127.0.0.1',port=0,open_browser=True,timeout_seconds=180,
        authorization_prompt_message='Open this Google sign-in link if the browser did not open: {url}',
        success_message='YouTube connected. You can close this tab and return to Video Batch Merger.')
    return flow.credentials


def upload(path, credentials, title, privacy='private', progress=lambda message:None, cancel=None, made_for_kids=False):
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    from googleapiclient.errors import HttpError
    import google_auth_httplib2, httplib2
    import threading
    cancel=cancel or threading.Event()
    if privacy not in ('private','unlisted','public'): raise ValueError('Invalid visibility.')
    if not title.strip() or len(title)>100: raise ValueError('Title must be between 1 and 100 characters.')
    path=Path(path).resolve(strict=True)
    if path.stat().st_size == 0: raise ValueError('Cannot upload an empty file.')
    check_cancel(cancel)
    service=build('youtube','v3',http=google_auth_httplib2.AuthorizedHttp(credentials,http=httplib2.Http(timeout=60)),cache_discovery=False)
    media=MediaFileUpload(str(path),chunksize=8*1024*1024,resumable=True)
    request=service.videos().insert(part='snippet,status',body={
        'snippet':{'title':title,'description':'Merged using Video Batch Merger.','categoryId':'22'},
        'status':{'privacyStatus':privacy,'selfDeclaredMadeForKids':made_for_kids}},media_body=media)
    try:
        result=None
        while result is None:
            check_cancel(cancel)
            status,result=request.next_chunk(num_retries=5)
            if status: progress(f'Uploading {path.name}: {status.progress()*100:.0f}%')
        if not result.get('id'): raise RuntimeError('YouTube did not return a video ID.')
        return 'https://www.youtube.com/watch?v='+result['id']
    except HttpError as error:
        try: message=json.loads(error.content.decode())['error']['message']
        except Exception: message=f'YouTube error {error.resp.status}.'
        raise RuntimeError(message+' Check channel verification, API quota, consent-screen test users and app permissions.') from None
    finally:
        media._fd.close()
        service.close()
