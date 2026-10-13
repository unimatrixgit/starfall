"""Original procedural desert-space score; no sampled commercial recording."""
import sys, math, wave, struct, random, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT.parent/'video-runtime'))
import imageio_ffmpeg
rate=22050;seconds=96;data=bytearray();rng=random.Random(94);filtered=0
for i in range(rate*seconds):
    t=i/rate;noise=rng.uniform(-1,1);filtered=.985*filtered+.015*noise
    chord=[(55,82.407,110),(51.913,77.782,103.826),(49,73.416,98),(55,82.407,110)][int(t/24)%4]
    swell=.4+.6*math.sin(math.pi*(t%24)/24)**2
    drone=sum(math.sin(math.tau*f*t)+.22*math.sin(math.tau*f*1.001*t) for f in chord)*.035*swell
    brass=sum(math.sin(math.tau*chord[0]*h*t)/h for h in [1,2,3,4,6])*.036*math.sin(math.pi*(t%12)/12)**4
    choir=sum(math.sin(math.tau*f*4*t)+.15*math.sin(math.tau*f*8*t) for f in chord)*.012*(.4+.6*math.sin(t*.15)**2)
    beat=t%1.5;drum=(math.sin(math.tau*(45-15*beat)*beat)*.08+filtered*.18)*math.exp(-beat*14)
    shimmer=.012*math.sin(math.tau*chord[int(t/3)%3]*8*t)*math.sin(math.pi*(t%3)/3)**4
    fade=min(1,t/4,(seconds-t)/4)
    val=(drone+brass+choir+drum+shimmer)*max(0,fade)
    data.extend(struct.pack('<h',int(max(-.8,min(.8,val))*32767)))
cache=ROOT.parent/'media-render';cache.mkdir(exist_ok=True)
wav=cache/'vesper-desert-score.wav'
with wave.open(str(wav),'wb') as f:f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(data)
out=ROOT/'dist/assets/media/vesper-desert-score.mp3'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-i',str(wav),'-codec:a','libmp3lame','-b:a','96k',str(out)],check=True)
print('Original ambient score:',seconds,'seconds;',out.stat().st_size,'bytes')
