import hashlib, json, shutil, subprocess, tempfile, threading, unittest
from pathlib import Path
from unittest.mock import patch
from merge_engine import Clip, inspect, merge, batches, grouped_batches, Cancelled

class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=tempfile.TemporaryDirectory(); cls.path=Path(cls.root.name)
        cls.ffmpeg=shutil.which('ffmpeg');cls.ffprobe=shutil.which('ffprobe');cls.cancel=threading.Event()
        cls.audio=cls.path/"Honda's holiday clip.mp4";cls.silent=cls.path/'Silent portrait.mp4'
        subprocess.run([cls.ffmpeg,'-v','error','-f','lavfi','-i','color=c=red:s=96x64:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-metadata','creation_time=2025-07-04T12:30:00Z',str(cls.audio)],check=True)
        subprocess.run([cls.ffmpeg,'-v','error','-f','lavfi','-i','color=c=blue:s=64x96:r=24','-t','0.5','-c:v','libx264','-pix_fmt','yuv420p',str(cls.silent)],check=True)
    @classmethod
    def tearDownClass(cls):cls.root.cleanup()
    def test_mixed_audio_dimensions_and_order(self):
        originals={p:hashlib.sha256(p.read_bytes()).hexdigest()for p in [self.audio,self.silent]}
        clips=[inspect(p,self.ffprobe,self.cancel)for p in [self.audio,self.silent]*5]
        output=self.path/'merged-10.mp4'
        merge(clips,output,self.ffmpeg,self.ffprobe,self.cancel,dimensions=(128,72))
        info=json.loads(subprocess.check_output([self.ffprobe,'-v','error','-show_streams','-show_format','-of','json',str(output)]))
        video=next(s for s in info['streams']if s['codec_type']=='video');audio=next(s for s in info['streams']if s['codec_type']=='audio')
        self.assertEqual((video['width'],video['height']),(128,72));self.assertEqual(audio['sample_rate'],'48000')
        self.assertAlmostEqual(float(info['format']['duration']),sum(c.duration for c in clips),delta=.5)
        # Decode samples from the first red clip and subsequent blue clip to verify order.
        for when,color in [('0.1',0),('0.65',2)]:
            pixel=subprocess.check_output([self.ffmpeg,'-v','error','-ss',when,'-i',str(output),'-frames:v','1','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-'])
            self.assertGreater(pixel[color],pixel[2 if color==0 else 0]+100)
        for p,digest in originals.items():self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),digest)
        with self.assertRaises(FileExistsError):merge(clips,output,self.ffmpeg,self.ffprobe,self.cancel,dimensions=(128,72))
        self.assertFalse(list(self.path.glob('*.part.mp4')))
    def test_duration_limit_real_probe(self):
        path=self.path/'long.mp4'
        subprocess.run([self.ffmpeg,'-v','error','-f','lavfi','-i','color=s=32x24:r=1','-t','301','-c:v','libx264',str(path)],check=True)
        with self.assertRaisesRegex(ValueError,'Longer than five'):inspect(path,self.ffprobe,self.cancel)
        self.assertEqual(inspect(self.audio,self.ffprobe,self.cancel).recorded_date,'2025-07-04')
    def test_batches_and_grouping(self):
        clips=[Clip(Path(f'IMG_{i:03}.mp4'),1,False,'2025-01-01',10)for i in range(21)]
        self.assertEqual([len(b)for b in batches(clips,10)],[10,10,1]);self.assertEqual([len(b)for b in batches(clips,20)],[20,1])
        self.assertEqual([len(b)for _,b in grouped_batches(clips,10,'Name prefix')],[10,10,1])
        more=[Clip(Path('z.mp4'),1,False,'2025-01-02',600*1024**2),Clip(Path('a.mp4'),1,False,'2025-01-01',120*1024**2)]
        self.assertEqual([k for k,_ in grouped_batches(more,10,'Date','Date')],['2025-01-01','2025-01-02'])
        self.assertEqual([k for k,_ in grouped_batches(more,10,'Size range','Size')],['Medium-100-to-500MB','Large-500MB-and-up'])
    def test_cancel_does_not_create_output(self):
        cancel=threading.Event();cancel.set();output=self.path/'cancel.mp4'
        with self.assertRaises(Cancelled):merge([inspect(self.audio,self.ffprobe,self.cancel)],output,self.ffmpeg,self.ffprobe,cancel)
        self.assertFalse(output.exists());self.assertTrue(self.audio.exists())
    def test_failed_conversion_does_not_publish_output(self):
        output=self.path/'failed.mp4';clip=Clip(self.path/'missing.mp4',1,False)
        with self.assertRaises(RuntimeError):merge([clip],output,self.ffmpeg,self.ffprobe,self.cancel,dimensions=(128,72))
        self.assertFalse(output.exists());self.assertFalse(list(self.path.glob('*.part.mp4')))

if __name__=='__main__':unittest.main()
