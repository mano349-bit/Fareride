from __future__ import annotations
import csv, json, os, queue, re, shutil, sys, threading, traceback, uuid, webbrowser
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from merge_engine import VIDEO_EXTENSIONS, tools, inspect, merge, grouped_batches, Cancelled

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Video Batch Merger + YouTube')
        if os.name=='nt':
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('VideoBatchMerger.Desktop')
            icon=Path(getattr(sys,'_MEIPASS',Path(__file__).parent))/'app.ico'
            if icon.exists(): self.iconbitmap(str(icon))
        self.geometry('1000x740'); self.minsize(820,650)
        self.paths=[]; self.outputs=[]; self.credentials=None; self.cancel=threading.Event(); self.events=queue.Queue(); self.busy=False
        self.batch=tk.StringVar(value='10'); self.group=tk.StringVar(value='None'); self.sort=tk.StringVar(value='Manual')
        self.resolution=tk.StringVar(value='Landscape 1080p'); self.output=tk.StringVar(); self.client=tk.StringVar()
        self.privacy=tk.StringVar(value='private'); self.title_prefix=tk.StringVar(value='My videos'); self.kids=tk.BooleanVar(value=False)
        self.status=tk.StringVar(value='Choose videos, choose an output folder, then merge. Originals stay in place.')
        style=ttk.Style(); style.theme_use('vista' if 'vista' in style.theme_names() else 'clam'); style.configure('TButton',padding=7)
        outer=ttk.Frame(self,padding=16); outer.pack(fill='both',expand=True)
        ttk.Label(outer,text='Video Batch Merger',font=('Segoe UI',22,'bold')).pack(anchor='w')
        ttk.Label(outer,text='Merge short videos in batches, then upload only when you click Upload.').pack(anchor='w',pady=(0,12))
        buttons=ttk.Frame(outer); buttons.pack(fill='x')
        for label,command in [('Add videos',self.add),('Add folder',self.add_folder),('Remove',self.remove),('Move up',lambda:self.move(-1)),('Move down',lambda:self.move(1))]: ttk.Button(buttons,text=label,command=command).pack(side='left',padx=(0,5))
        box=ttk.Frame(outer); box.pack(fill='both',expand=True,pady=8)
        self.list=tk.Listbox(box,selectmode='extended',font=('Segoe UI',10),height=10,exportselection=False)
        scroll=ttk.Scrollbar(box,command=self.list.yview); self.list.configure(yscrollcommand=scroll.set); self.list.pack(side='left',fill='both',expand=True); scroll.pack(side='right',fill='y')
        settings=ttk.Frame(outer); settings.pack(fill='x')
        for label,var,choices in [('Batch',self.batch,['10','20']),('Group by',self.group,['None','Date','Name prefix','Size range']),('Sort by',self.sort,['Manual','Date','Name','Size']),('Output',self.resolution,['Landscape 1080p','Landscape 720p','Portrait 1080p'])]:
            ttk.Label(settings,text=label).pack(side='left',padx=(0,4)); ttk.Combobox(settings,textvariable=var,values=choices,state='readonly',width=17 if label=='Output' else 12).pack(side='left',padx=(0,12))
        ttk.Label(outer,text='Date: recorded day, or modified day if missing. Name: prefix before trailing numbers. Size: <100 / 100–500 / ≥500 MiB.\nEach group is split into 10 or 20 clips. A smaller final batch is included. Clips over 5 minutes are skipped.',wraplength=950).pack(anchor='w',pady=7)
        outrow=ttk.Frame(outer); outrow.pack(fill='x')
        ttk.Label(outrow,text='Save merged videos to:').pack(side='left'); ttk.Entry(outrow,textvariable=self.output).pack(side='left',fill='x',expand=True,padx=8)
        ttk.Button(outrow,text='Browse',command=lambda:self.choose_folder()).pack(side='left')
        action=ttk.Frame(outer); action.pack(fill='x',pady=9)
        self.merge_button=ttk.Button(action,text='Merge videos',command=self.start_merge); self.merge_button.pack(side='left')
        ttk.Button(action,text='Open output folder',command=self.open_output).pack(side='left',padx=8)
        ttk.Button(action,text='Cancel current task',command=self.cancel.set).pack(side='left')
        uploadbox=ttk.LabelFrame(outer,text='YouTube — optional',padding=10); uploadbox.pack(fill='x',pady=5)
        clientrow=ttk.Frame(uploadbox); clientrow.pack(fill='x')
        ttk.Label(clientrow,text='OAuth Desktop client JSON:').pack(side='left'); ttk.Entry(clientrow,textvariable=self.client).pack(side='left',fill='x',expand=True,padx=8)
        ttk.Button(clientrow,text='Browse',command=self.choose_client).pack(side='left'); ttk.Button(clientrow,text='Sign in to YouTube',command=self.login).pack(side='left',padx=5)
        row=ttk.Frame(uploadbox); row.pack(fill='x',pady=7)
        ttk.Label(row,text='Title prefix:').pack(side='left'); ttk.Entry(row,textvariable=self.title_prefix,width=20).pack(side='left',padx=5)
        ttk.Label(row,text='Visibility:').pack(side='left'); ttk.Combobox(row,textvariable=self.privacy,values=['private','unlisted','public'],state='readonly',width=9).pack(side='left',padx=5)
        ttk.Checkbutton(row,text='Made for kids',variable=self.kids).pack(side='left',padx=5)
        ttk.Button(row,text='Upload videos…',command=self.start_upload).pack(side='right')
        ttk.Label(uploadbox,text='Google setup is required (see README). Sign-in tokens stay in memory. Videos longer than 15 minutes require channel verification.',wraplength=920).pack(anchor='w')
        self.bar=ttk.Progressbar(outer,mode='indeterminate'); self.bar.pack(fill='x',pady=(8,4))
        ttk.Label(outer,textvariable=self.status,wraplength=950).pack(anchor='w')
        menu=tk.Menu(self)
        files=tk.Menu(menu,tearoff=False)
        files.add_command(label='Add videos…',command=self.add);files.add_command(label='Add folder…',command=self.add_folder)
        files.add_separator();files.add_command(label='Choose output folder…',command=self.choose_folder);files.add_command(label='Exit',command=self.close)
        menu.add_cascade(label='File',menu=files)
        helpmenu=tk.Menu(menu,tearoff=False)
        helpmenu.add_command(label='YouTube setup guide',command=lambda:webbrowser.open('https://developers.google.com/youtube/v3/guides/uploading_a_video'))
        helpmenu.add_command(label='About',command=lambda:messagebox.showinfo('Video Batch Merger','Video Batch Merger 0.2\nLocal video merging with optional YouTube uploads.\nYour original videos are never deleted.'))
        menu.add_cascade(label='Help',menu=helpmenu);self.configure(menu=menu)
        self.after(100,self.drain); self.protocol('WM_DELETE_WINDOW',self.close)
    def refresh(self):
        self.list.delete(0,'end')
        for index,path in enumerate(self.paths):
            try: info=path.stat(); label=f'{info.st_size/1024**2:.1f} MiB | modified {datetime.fromtimestamp(info.st_mtime):%Y-%m-%d}'
            except OSError: label='Unavailable'
            self.list.insert('end',f'{index+1:03}. {path.name} | {label} | {path.parent}')
    def add_paths(self,paths):
        if self.busy:return
        seen={str(p).lower() for p in self.paths}
        for name in paths:
            path=Path(name).resolve()
            if path.suffix.lower() in VIDEO_EXTENSIONS and not path.name.lower().endswith('.d.mts') and str(path).lower() not in seen:
                self.paths.append(path);seen.add(str(path).lower())
        self.refresh();self.status.set(f'{len(self.paths)} videos queued. Their lengths will be checked before merging.')
    def add(self):self.add_paths(filedialog.askopenfilenames(title='Choose videos',filetypes=[('Video files','*.mp4 *.mov *.mkv *.avi *.wmv *.m4v *.webm *.mts *.m2ts *.mpg *.mpeg *.3gp'),('All files','*.*')]))
    def add_folder(self):
        if self.busy:return
        folder=filedialog.askdirectory(title='Choose a video folder (this folder only)')
        if folder:self.add_paths(sorted(p for p in Path(folder).iterdir() if p.is_file()))
    def remove(self):
        if self.busy:return
        for index in reversed(self.list.curselection()):del self.paths[index]
        self.refresh()
    def move(self,direction):
        if self.busy:return
        selected=self.list.curselection()
        if len(selected)!=1:return
        index=selected[0];new=index+direction
        if 0<=new<len(self.paths):self.paths[index],self.paths[new]=self.paths[new],self.paths[index];self.refresh();self.list.selection_set(new)
    def choose_folder(self):
        folder=filedialog.askdirectory(title='Where should merged videos be saved?')
        if folder:self.output.set(folder)
    def choose_client(self):
        path=filedialog.askopenfilename(title='Choose Google OAuth Desktop client JSON',filetypes=[('JSON','*.json')])
        if path:self.client.set(path);self.credentials=None
    def open_output(self):
        if self.output.get() and Path(self.output.get()).is_dir():webbrowser.open(Path(self.output.get()).resolve().as_uri())
    def send(self,message):self.events.put(('status',message))
    def launch(self,work):
        if self.busy:return
        self.busy=True;self.cancel.clear();self.bar.start();self.merge_button.configure(state='disabled')
        def worker():
            try:work()
            except Cancelled as error:self.events.put(('error',str(error)))
            except Exception as error:self.events.put(('error',str(error)))
            finally:self.events.put(('done',None))
        threading.Thread(target=worker,daemon=True).start()
    def start_merge(self):
        if self.busy:return
        if not self.paths:messagebox.showinfo('Add videos','Choose your videos first.');return
        if not self.output.get():self.choose_folder()
        if not self.output.get():return
        paths=list(self.paths);folder=Path(self.output.get());size=int(self.batch.get());group=self.group.get();sort=self.sort.get();resolution=self.resolution.get()
        dimensions={'Landscape 1080p':(1920,1080),'Landscape 720p':(1280,720),'Portrait 1080p':(1080,1920)}[resolution]
        def work():
            ffmpeg,ffprobe=tools(self.send,self.cancel);eligible=[];skipped=[]
            for index,path in enumerate(paths):
                self.send(f'Checking duration {index+1}/{len(paths)}: {path.name}')
                try:eligible.append(inspect(path,ffprobe,self.cancel))
                except Cancelled:raise
                except Exception as error:skipped.append((str(path),str(error)))
            if not eligible:raise RuntimeError('No eligible videos. Choose playable videos up to five minutes long.\n'+ '\n'.join(reason for _,reason in skipped[:4]))
            plan=grouped_batches(eligible,size,group,sort);run_id=datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]
            folder.mkdir(parents=True,exist_ok=True);manifest=folder/f'Merge-report-{run_id}.csv'
            with manifest.open('w',newline='',encoding='utf-8-sig') as report:
                writer=csv.writer(report);writer.writerow(['Status','Output','Input','Seconds','Group','Reason'])
                for path,reason in skipped:writer.writerow(['Skipped','',path,'','',reason])
                for index,(label,clips) in enumerate(plan):
                    safe=re.sub(r'[^A-Za-z0-9_-]+','-',label)[:40] or 'Videos'
                    target=folder/f'Merged-{run_id}-{safe}-{index+1:03}.mp4'
                    merged=merge(clips,target,ffmpeg,ffprobe,self.cancel,lambda text:self.send(f'Batch {index+1}/{len(plan)} — {text}'),dimensions)
                    self.events.put(('output',str(merged)))
                    for clip in clips:writer.writerow(['Merged',str(merged),str(clip.path),clip.duration,label,''])
                    report.flush()
            self.events.put(('success',f'Created {len(plan)} merged videos. Skipped {len(skipped)} files. Originals are unchanged.\nReport: {manifest}'))
        self.launch(work)
    def login(self):
        if self.busy:return
        if not self.client.get():self.choose_client()
        if not self.client.get():return
        client=self.client.get()
        def work():
            from youtube_upload import sign_in
            credentials=sign_in(client,self.send)
            self.events.put(('credentials',credentials));self.send('YouTube connected. Click Upload videos to choose the files you want to upload.')
        self.launch(work)
    def start_upload(self):
        if self.busy:return
        if not self.credentials:messagebox.showinfo('Connect YouTube','Choose your Desktop OAuth client JSON, then click Sign in to YouTube. See README for setup.');return
        paths=filedialog.askopenfilenames(title='Choose merged videos to upload',initialdir=self.output.get() or None,filetypes=[('MP4 videos','*.mp4')])
        if not paths:return
        privacy=self.privacy.get();prefix=self.title_prefix.get().strip();kids=self.kids.get();credentials=self.credentials
        if not messagebox.askyesno('Upload to YouTube',f'Upload {len(paths)} selected video(s) to the signed-in YouTube channel?\nVisibility: {privacy.upper()}\nMade for kids: {"Yes" if kids else "No"}\nLocal files will remain on your computer.'):return
        def work():
            from youtube_upload import upload
            folder=Path(paths[0]).parent;report=folder/f'YouTube-uploads-{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}.csv'
            with report.open('w',newline='',encoding='utf-8-sig') as log:
                writer=csv.writer(log);writer.writerow(['File','Requested visibility','URL'])
                for index,path in enumerate(paths):
                    title=(prefix+' '+Path(path).stem).strip()[:100]
                    url=upload(path,credentials,title,privacy,lambda message:self.send(f'{index+1}/{len(paths)} — {message}'),self.cancel,kids)
                    writer.writerow([path,privacy,url]);log.flush();self.send('Uploaded: '+url)
            self.events.put(('success',f'Uploaded {len(paths)} videos. YouTube may still be processing them.\nLinks saved in {report}'))
        self.launch(work)
    def drain(self):
        try:
            while True:
                kind,value=self.events.get_nowait()
                if kind=='status':self.status.set(value)
                elif kind=='output':self.outputs.append(value)
                elif kind=='credentials':self.credentials=value
                elif kind=='success':self.status.set(value);messagebox.showinfo('Complete',value)
                elif kind=='error':self.status.set(value);messagebox.showerror('Task stopped',value)
                elif kind=='done':self.busy=False;self.bar.stop();self.merge_button.configure(state='normal')
        except queue.Empty:pass
        self.after(100,self.drain)
    def close(self):
        if self.busy:
            if messagebox.askyesno('Task running','Cancel the current task? Completed outputs stay in place. YouTube may finish an in-flight upload chunk.'):
                self.cancel.set();self.status.set('Cancelling… close this window once the task has stopped.')
            return
        self.credentials=None;self.destroy()

if __name__=='__main__':App().mainloop()
