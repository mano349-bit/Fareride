import json, sys, tempfile, threading, unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from merge_engine import Cancelled
import youtube_upload

class UploadTests(unittest.TestCase):
    def setUp(self):
        self.root=tempfile.TemporaryDirectory();self.path=Path(self.root.name)/'merged.mp4';self.path.write_bytes(b'fixture')
    def tearDown(self):self.root.cleanup()
    def test_private_default_and_resumable_progress(self):
        service=MagicMock();request=service.videos.return_value.insert.return_value
        status=MagicMock();status.progress.return_value=.5;request.next_chunk.side_effect=[(status,None),(None,{'id':'fixture-id'})]
        logs=[]
        with patch('googleapiclient.discovery.build',return_value=service),patch('google_auth_httplib2.AuthorizedHttp'):
            result=youtube_upload.upload(self.path,MagicMock(),'My merged video',progress=logs.append)
        call=service.videos.return_value.insert.call_args.kwargs
        self.assertEqual(call['body']['status']['privacyStatus'],'private');self.assertFalse(call['body']['status']['selfDeclaredMadeForKids'])
        self.assertTrue(call['media_body'].resumable());self.assertEqual(call['media_body'].chunksize(),8*1024*1024)
        self.assertIn('50%',logs[0]);self.assertEqual(result,'https://www.youtube.com/watch?v=fixture-id');request.next_chunk.assert_called_with(num_retries=5)
        self.assertTrue(call['media_body']._fd.closed);service.close.assert_called_once();self.assertEqual(self.path.read_bytes(),b'fixture')
    def test_cancel_before_upload_creates_no_request(self):
        cancel=threading.Event();cancel.set()
        with patch('googleapiclient.discovery.build')as build,self.assertRaises(Cancelled):youtube_upload.upload(self.path,MagicMock(),'Title',cancel=cancel)
        build.assert_not_called()
    def test_desktop_client_required(self):
        path=Path(self.root.name)/'client.json';path.write_text(json.dumps({'web':{}}))
        with self.assertRaisesRegex(ValueError,'Desktop'):youtube_upload.sign_in(path)
    def test_oauth_scope_and_loopback(self):
        path=Path(self.root.name)/'client.json';path.write_text(json.dumps({'installed':{}}));flow=MagicMock()
        with patch('google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file',return_value=flow)as setup:
            result=youtube_upload.sign_in(path)
        self.assertEqual(setup.call_args.args[1],['https://www.googleapis.com/auth/youtube.upload']);self.assertEqual(result,flow.credentials)
        self.assertEqual(flow.run_local_server.call_args.kwargs['host'],'127.0.0.1');self.assertEqual(flow.run_local_server.call_args.kwargs['port'],0)
    def test_api_error_does_not_delete_local_video(self):
        from googleapiclient.errors import HttpError
        import httplib2
        service=MagicMock();service.videos.return_value.insert.return_value.next_chunk.side_effect=HttpError(httplib2.Response({'status':'403'}),b'{"error":{"message":"quota exceeded"}}')
        with patch('googleapiclient.discovery.build',return_value=service),patch('google_auth_httplib2.AuthorizedHttp'),self.assertRaisesRegex(RuntimeError,'quota exceeded'):
            youtube_upload.upload(self.path,MagicMock(),'Title')
        self.assertTrue(self.path.exists());service.close.assert_called_once()

if __name__=='__main__':unittest.main()
