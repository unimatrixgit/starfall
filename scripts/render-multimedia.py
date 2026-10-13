import sys, math, random, wave, struct, subprocess, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT.parent/'video-runtime'))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
OUT=ROOT/'dist/assets/media';OUT.mkdir(parents=True,exist_ok=True)
CACHE=ROOT.parent/'media-render';CACHE.mkdir(exist_ok=True)
W,H,FPS=1280,720,24
FONT=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',28)
SMALL=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',15)
SCENES=[('helion-battle','helion-velari','HELION / VELARI',(115,211,255),(845,315)),('nexari-battle','nexari-kryth','NEXARI AMBUSH / KRYTH',(133,234,161),(825,360)),('auralis-battle','auralis-defense','AURALIS / ORBITAL SIEGE',(247,214,125),(990,260))]
BASES={key:Image.open(ROOT/'media-source'/f'{key}.png').convert('RGB').resize((W,H),Image.Resampling.LANCZOS) for key,*_ in SCENES}
UI=Image.open(ROOT/'media-source/game-interface.png').convert('RGB').resize((W,H),Image.Resampling.LANCZOS)
PARTICLES=[(random.Random(i).uniform(0,math.tau),random.Random(i+400).uniform(35,250),random.Random(i+700).uniform(.5,2.3)) for i in range(55)]
def audio_file(name,duration,events):
    path=CACHE/f'{name}.wav';rng=random.Random(32);rate=44100;data=bytearray();filtered=0
    for i in range(int(duration*rate)):
        t=i/rate;noise=rng.uniform(-1,1);filtered=.93*filtered+.07*noise
        # Original cinematic score: minor-key pads, bass, pulse and a sparse lead.
        chords=[(110,130.81,164.81),(87.31,110,130.81),(98,123.47,146.83),(82.41,98,123.47)]
        chord=chords[int(t/6)%4];fade=min(1,t/2,(duration-t)/2)
        pad=sum(math.sin(math.tau*f*t)+.35*math.sin(math.tau*f*1.002*t) for f in chord)*.027
        bass=.065*math.sin(math.tau*chord[0]/2*t)
        pulse=.035*math.sin(math.tau*chord[int(t*2)%3]*2*t)*math.exp(-(t% .5)*8)
        lead_notes=[329.63,392,440,523.25,440,392,329.63,293.66]
        lead=.024*math.sin(math.tau*lead_notes[int(t/1.5)%8]*t)*math.sin(math.pi*(t%1.5)/1.5)**2
        value=(pad+bass+pulse+lead)*max(0,fade)
        for e in events:
            age=t-e
            if 0<age<1.6:value+=(filtered*1.5+math.sin(math.tau*(65-20*age)*age)*.20)*math.exp(-age*3.5)
        if int(t*3)%4==0:value+=.025*math.sin(1500*t+math.sin(t*30)*4)*math.exp(-(t%(.333))*13)
        data.extend(struct.pack('<h',int(max(-.8,min(.8,value))*32767)))
    with wave.open(str(path),'wb') as f:f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(data)
    return path

def frame(key,title,color,impact,t,duration,ui=False):
    base=UI if ui else BASES[key];zoom=1+(.025 if ui else .055)*t/duration
    cw,ch=int(W/zoom),int(H/zoom);x=int((W-cw)*(.35+.2*math.sin(t*.4)));y=int((H-ch)*.4)
    image=base.crop((x,y,x+cw,y+ch)).resize((W,H),Image.Resampling.BICUBIC).convert('RGBA')
    overlay=Image.new('RGBA',(W,H));d=ImageDraw.Draw(overlay)
    if not ui:
        for n in range(4):
            phase=(t*.9+n*.23)%1;start=(int(W*(.12+n*.025)),int(H*(.17+n*.14)));end=(int(impact[0]+n*20),int(impact[1]+n*13))
            px=int(start[0]+(end[0]-start[0])*phase);py=int(start[1]+(end[1]-start[1])*phase)
            d.line((px-35,py+9,px+30,py-9),fill=(*color,210),width=3)
        for event in [2.2,5.4,9.2,13.6,17.8,21.2]:
            age=t-event
            if 0<=age<1.5:
                radius=int(15+age*145);alpha=int(210*math.exp(-age*2.2));cx,cy=impact
                d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline=(255,185,95,alpha),width=max(1,int(8*(1-age/1.5))))
                if age<.4:
                    rr=int(15+age*85);d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),fill=(255,223,156,int(180*(1-age/.4))))
                for angle,speed,size in PARTICLES:
                    px=cx+math.cos(angle)*speed*age;py=cy+math.sin(angle)*speed*age
                    d.line((px,py,px-math.cos(angle)*10,py-math.sin(angle)*10),fill=(255,195,120,alpha),width=max(1,int(size)))
    d.rounded_rectangle((24,24,580,118),radius=8,fill=(4,17,29,210),outline=(*color,145),width=1)
    d.text((42,37),'STARFALL COMMAND  /  MULTIMEDIA',font=SMALL,fill=(*color,255));d.text((40,64),title,font=FONT,fill=(241,248,255,255))
    d.rounded_rectangle((24,H-68,W-24,H-24),radius=5,fill=(4,17,29,220),outline=(*color,105),width=1)
    d.text((40,H-57),'GAME INTERFACE TOUR' if ui else 'AI BATTLE CONCEPT  /  CINEMATIC SIMULATION',font=SMALL,fill=(223,236,245,255))
    d.rectangle((W-330,H-51,W-48,H-46),fill=(35,64,83,220));d.rectangle((W-330,H-51,W-330+int(282*t/duration),H-46),fill=(*color,230))
    # Bracketed command reticle makes the artwork read as a cinematic RTS concept.
    for xx,yy,sx,sy in [(16,150,1,1),(W-16,150,-1,1),(16,H-100,1,-1),(W-16,H-100,-1,-1)]:
        d.line((xx,yy,xx+sx*25,yy),fill=(*color,110),width=2);d.line((xx,yy,xx,yy+sy*25),fill=(*color,110),width=2)
    image=Image.alpha_composite(image,overlay)
    fade=min(1,t/.35,(duration-t)/.35)
    if fade<1:image=Image.blend(Image.new('RGBA',(W,H),(3,11,20,255)),image,max(0,fade))
    return image.convert('RGB')

def encode(name,parts):
    duration=sum(part[5] for part in parts);events=[];offset=0
    for part in parts:
        if not part[6]:events.extend(offset+e for e in [2.2,5.4,9.2,13.6,17.8,21.2] if e<part[5]-1)
        offset+=part[5]
    audio=audio_file(name,duration,events);path=OUT/f'{name}.mp4'
    command=[FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(audio),'-c:v','libx264','-preset','fast','-crf','29','-maxrate','1100k','-bufsize','2200k','-c:a','aac','-b:a','64k','-pix_fmt','yuv420p','-movflags','+faststart','-shortest',str(path)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for key,title,color,impact,start,length,isui in parts:
            for i in range(int(length*FPS)):process.stdin.write(frame(key,title,color,impact,start+i/FPS,length,ui=isui).tobytes())
        process.stdin.close();error=process.stderr.read().decode();code=process.wait()
        if code:raise RuntimeError(error)
    except Exception:
        process.kill();raise
    probe=subprocess.run([FFMPEG,'-hide_banner','-i',str(path)],capture_output=True,text=True).stderr
    if 'Video: h264' not in probe or 'Audio: aac' not in probe:raise RuntimeError('Missing expected codecs: '+probe)
    print(name,round(duration,2),'seconds',round(path.stat().st_size/1024),'KiB',flush=True)
    return {'file':name+'.mp4','seconds':duration,'width':W,'height':H,'fps':FPS,'bytes':path.stat().st_size}

metadata=[]
for key,name,title,color,impact in SCENES:
    BASES[key].save(OUT/f'{name}.webp',quality=83)
    metadata.append(encode(name,[(key,title,color,impact,0,24,False)]))
UI.save(OUT/'starfall-command-montage.webp',quality=83)
parts=[('ui','YOUR WORLD / YOUR COMMAND',(145,205,228),(0,0),0,8,True)]+[(key,title,color,impact,0,24,False) for key,name,title,color,impact in SCENES]
metadata.append(encode('starfall-command-montage',parts))
(OUT/'metadata.json').write_text(json.dumps(metadata,indent=2))
